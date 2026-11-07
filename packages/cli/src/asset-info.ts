// CLI-only container inspection. No media decoder or IO in core.
export interface AssetInfo {
  mime: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
}
export function sniff(bytes: Buffer): AssetInfo {
  const info: AssetInfo = { mime: 'application/octet-stream', size: bytes.length };
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (bytes.length < 33 || bytes.toString('ascii', 12, 16) !== 'IHDR')
      throw Error('truncated PNG');
    return {
      ...info,
      mime: 'image/png',
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }
  if (['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))) {
    if (bytes.length < 10) throw Error('truncated GIF');
    return {
      ...info,
      mime: 'image/gif',
      width: bytes.readUInt16LE(6),
      height: bytes.readUInt16LE(8),
    };
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let p = 2;
    while (p + 4 <= bytes.length) {
      if (bytes[p++] !== 255) throw Error('invalid JPEG marker');
      while (bytes[p] === 255) p++;
      const marker = bytes[p++]!;
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = bytes.readUInt16BE(p);
      if (length < 2 || p + length > bytes.length) throw Error('truncated JPEG');
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (length < 8) throw Error('invalid JPEG frame');
        return {
          ...info,
          mime: 'image/jpeg',
          height: bytes.readUInt16BE(p + 3),
          width: bytes.readUInt16BE(p + 5),
        };
      }
      p += length;
    }
    throw Error('JPEG has no frame');
  }
  if (bytes.toString('ascii', 0, 4) === 'RIFF') {
    if (bytes.length < 12 || bytes.readUInt32LE(4) + 8 > bytes.length)
      throw Error('truncated RIFF');
    const type = bytes.toString('ascii', 8, 12);
    if (type === 'WEBP') {
      const tag = bytes.toString('ascii', 12, 16);
      if (tag === 'VP8X' && bytes.length >= 30)
        return {
          ...info,
          mime: 'image/webp',
          width: 1 + bytes.readUIntLE(24, 3),
          height: 1 + bytes.readUIntLE(27, 3),
        };
      if (tag === 'VP8L' && bytes.length >= 25 && bytes[20] === 47) {
        const v = bytes.readUInt32LE(21);
        return {
          ...info,
          mime: 'image/webp',
          width: 1 + (v & 16383),
          height: 1 + ((v >>> 14) & 16383),
        };
      }
      if (
        tag === 'VP8 ' &&
        bytes.length >= 30 &&
        bytes.subarray(23, 26).equals(Buffer.from([157, 1, 42]))
      )
        return {
          ...info,
          mime: 'image/webp',
          width: bytes.readUInt16LE(26) & 16383,
          height: bytes.readUInt16LE(28) & 16383,
        };
      throw Error('unsupported or truncated WebP header');
    }
    if (type === 'WAVE') {
      let rate = 0,
        data = 0;
      for (let p = 12; p + 8 <= bytes.length;) {
        const length = bytes.readUInt32LE(p + 4),
          end = p + 8 + length;
        if (end > bytes.length) throw Error('truncated WAV chunk');
        const tag = bytes.toString('ascii', p, p + 4);
        if (tag === 'fmt ' && length >= 16) rate = bytes.readUInt32LE(p + 16);
        if (tag === 'data') data += length;
        p = end + (length % 2);
      }
      if (!rate || !data) throw Error('WAV needs fmt and data');
      return { ...info, mime: 'audio/wav', duration: data / rate };
    }
  }
  if (bytes.toString('ascii', 0, 4) === 'fLaC') {
    if (bytes.length < 42 || (bytes[4]! & 127) !== 0 || bytes.readUIntBE(5, 3) !== 34)
      throw Error('FLAC needs STREAMINFO');
    const v = bytes.readBigUInt64BE(18),
      rate = Number(v >> 44n);
    if (!rate) throw Error('invalid FLAC sample rate');
    const samples = Number(v & 0xfffffffffn);
    return { ...info, mime: 'audio/flac', ...(samples ? { duration: samples / rate } : {}) };
  }
  let p = 0;
  if (bytes.toString('ascii', 0, 3) === 'ID3') {
    if (bytes.length < 10 || bytes.subarray(6, 10).some((v) => v > 127))
      throw Error('invalid ID3 header');
    p = 10 + bytes.subarray(6, 10).reduce((n, v) => n * 128 + v, 0) + (bytes[5]! & 16 ? 10 : 0);
  }
  let duration = 0;
  while (p + 4 <= bytes.length && bytes[p] === 255 && (bytes[p + 1]! & 224) === 224) {
    const version = (bytes[p + 1]! >> 3) & 3,
      layer = (bytes[p + 1]! >> 1) & 3;
    const bi = bytes[p + 2]! >> 4,
      ri = (bytes[p + 2]! >> 2) & 3;
    if (version === 1 || layer !== 1 || !bi || bi === 15 || ri === 3)
      throw Error('invalid MP3 frame');
    const rate = [44100, 48000, 32000][ri]! / (version === 3 ? 1 : version === 2 ? 2 : 4);
    const kbps = (
      version === 3
        ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
        : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
    )[bi]!;
    const length =
      Math.floor(((version === 3 ? 144000 : 72000) * kbps) / rate) + ((bytes[p + 2]! >> 1) & 1);
    if (p + length > bytes.length) throw Error('truncated MP3 frame');
    duration += (version === 3 ? 1152 : 576) / rate;
    p += length;
  }
  if (duration) return { ...info, mime: 'audio/mpeg', duration };
  return info;
}
