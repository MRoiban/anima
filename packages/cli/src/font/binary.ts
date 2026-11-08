import { Bytes as ByteReader } from '../../../../modules/fonts/core/opentype/binary.ts';
import { fault } from '../../../../modules/fonts/core/opentype/binary.ts';
export { fault, diagnostic, MAX_FONT } from '../../../../modules/fonts/core/opentype/binary.ts';
export function checksum(data: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i += 4)
    sum =
      (sum +
        ((data[i] ?? 0) * 0x1000000 +
          ((data[i + 1] ?? 0) << 16) +
          ((data[i + 2] ?? 0) << 8) +
          (data[i + 3] ?? 0))) >>>
      0;
  return sum;
}
/** Canonical sfnt directory; deterministic padding and checkSumAdjustment. */
export function sfnt(tables: ReadonlyMap<string, Uint8Array>, flavor = 0x10000): Buffer {
  const entries = [...tables].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const n = entries.length;
  if (!n || n > 256) fault('invalid sfnt table count');
  let offset = 12 + n * 16;
  const out = Buffer.alloc(offset + entries.reduce((s, [, b]) => s + ((b.length + 3) & ~3), 0));
  out.writeUInt32BE(flavor);
  out.writeUInt16BE(n, 4);
  const power = 2 ** Math.floor(Math.log2(n));
  out.writeUInt16BE(power * 16, 6);
  out.writeUInt16BE(Math.log2(power), 8);
  out.writeUInt16BE((n - power) * 16, 10);
  let head = 0;
  entries.forEach(([tag, raw], i) => {
    const data = Buffer.from(raw);
    if (tag === 'head') {
      if (data.length < 54) fault('short head table');
      data.writeUInt32BE(0, 8);
      head = offset;
    }
    const p = 12 + i * 16;
    out.write(tag, p, 4, 'ascii');
    out.writeUInt32BE(checksum(data), p + 4);
    out.writeUInt32BE(offset, p + 8);
    out.writeUInt32BE(data.length, p + 12);
    data.copy(out, offset);
    offset += (data.length + 3) & ~3;
  });
  if (head) out.writeUInt32BE((0xb1b0afba - checksum(out)) >>> 0, head + 8);
  return out;
}

export class Bytes extends ByteReader {
  override slice(p: number, n: number): Buffer {
    const bytes = super.slice(p, n);
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
}
