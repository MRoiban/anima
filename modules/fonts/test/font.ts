/** Original, test-only TrueType font: a rectangle for A, B and replacement glyphs. */
export function testFont(advance = 600, first = 32, last = 126): number[] {
  const table = (size: number) => new DataView(new ArrayBuffer(size));
  const head = table(54);
  head.setUint32(0, 0x10000);
  head.setUint32(12, 0x5f0f3cf5);
  head.setUint16(18, 1000);
  head.setInt16(42, 700);
  head.setInt16(40, 500);
  head.setInt16(46, 8);
  head.setInt16(48, 2);
  const hhea = table(36);
  hhea.setUint32(0, 0x10000);
  hhea.setInt16(4, 800);
  hhea.setInt16(6, -200);
  hhea.setUint16(10, advance);
  hhea.setInt16(18, 1);
  hhea.setUint16(34, 2);
  const maxp = table(32);
  maxp.setUint32(0, 0x10000);
  maxp.setUint16(4, 2);
  maxp.setUint16(6, 4);
  maxp.setUint16(8, 1);
  maxp.setUint16(14, 1);
  const hmtx = table(8);
  hmtx.setUint16(0, advance);
  hmtx.setUint16(4, advance);
  const glyf = table(34);
  glyf.setInt16(0, 1);
  glyf.setInt16(6, 500);
  glyf.setInt16(8, 700);
  glyf.setUint16(10, 3); // endpoints, no instructions
  [1, 1, 1, 1].forEach((v, i) => glyf.setUint8(14 + i, v));
  [0, 500, 0, -500, 0, 0, 700, 0].forEach((v, i) => glyf.setInt16(18 + i * 2, v));
  const loca = table(6);
  loca.setUint16(4, 17);
  const count = last - first + 1;
  const cmap = table(44 + count * 2);
  cmap.setUint16(2, 1);
  cmap.setUint16(4, 3);
  cmap.setUint16(6, 1);
  cmap.setUint32(8, 12);
  cmap.setUint16(12, 4);
  cmap.setUint16(14, 32 + count * 2);
  cmap.setUint16(18, 4);
  cmap.setUint16(20, 4);
  cmap.setUint16(22, 1);
  cmap.setUint16(26, last);
  cmap.setUint16(28, 65535);
  cmap.setUint16(32, first);
  cmap.setUint16(34, 65535);
  cmap.setUint16(38, 1);
  cmap.setUint16(40, 4);
  for (let i = 0; i < count; i++) cmap.setUint16(44 + i * 2, 1);
  const name = table(6);
  name.setUint16(4, 6);
  const post = table(32);
  post.setUint32(0, 0x30000);
  const os2 = table(78);
  os2.setInt16(2, advance);
  os2.setUint16(4, 400);
  os2.setUint16(6, 5);
  os2.setUint16(64, 32);
  os2.setUint16(66, 126);
  os2.setInt16(68, 800);
  os2.setInt16(70, -200);
  os2.setUint16(74, 800);
  os2.setUint16(76, 200);
  const tables: Record<string, DataView> = {
    'OS/2': os2,
    cmap,
    glyf,
    head,
    hhea,
    hmtx,
    loca,
    maxp,
    name,
    post,
  };
  const entries = Object.entries(tables).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let offset = 12 + entries.length * 16;
  const out = table(offset + entries.reduce((n, [, v]) => n + ((v.byteLength + 3) & ~3), 0));
  out.setUint32(0, 0x10000);
  out.setUint16(4, entries.length);
  out.setUint16(6, 128);
  out.setUint16(8, 3);
  out.setUint16(10, entries.length * 16 - 128);
  let headOffset = 0;
  entries.forEach(([tag, v], i) => {
    const directory = 12 + i * 16;
    for (let j = 0; j < 4; j++) out.setUint8(directory + j, tag.charCodeAt(j));
    let checksum = 0;
    for (let j = 0; j < v.byteLength; j += 4) {
      let word = 0;
      for (let k = 0; k < 4; k++)
        word = (word << 8) | (j + k < v.byteLength ? v.getUint8(j + k) : 0);
      checksum = (checksum + word) >>> 0;
    }
    out.setUint32(directory + 4, checksum);
    out.setUint32(directory + 8, offset);
    out.setUint32(directory + 12, v.byteLength);
    new Uint8Array(out.buffer).set(new Uint8Array(v.buffer), offset);
    if (tag === 'head') headOffset = offset;
    offset += (v.byteLength + 3) & ~3;
  });
  let sum = 0;
  for (let i = 0; i < out.byteLength; i += 4) sum = (sum + out.getUint32(i)) >>> 0;
  out.setUint32(headOffset + 8, (0xb1b0afba - sum) >>> 0);
  return [...new Uint8Array(out.buffer)];
}
