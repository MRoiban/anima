// An original geometric test font. No third-party font data, timestamps or random values.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sfnt } from '../packages/cli/src/font/binary.ts';
import { cmap12 } from '../packages/cli/src/font/subset.ts';
import { encodeGlyph } from '../packages/cli/src/font/truetype.ts';

export function testFont(): Buffer {
  const chars = [
    ...Array.from({ length: 95 }, (_, i) => i + 32),
    0xc0,
    0xc9,
    0xe9,
    0x5d0,
    0x5d1,
    0x627,
    0x628,
    0x1f600,
  ];
  const count = chars.length + 1,
    tables = new Map<string, Buffer>();
  const head = Buffer.alloc(54);
  head.writeUInt32BE(0x10000);
  head.writeUInt32BE(0x10000, 4);
  head.writeUInt32BE(0x5f0f3cf5, 12);
  head.writeUInt16BE(3, 16);
  head.writeUInt16BE(1000, 18);
  head.writeInt16BE(550, 40);
  head.writeInt16BE(700, 42);
  head.writeUInt16BE(8, 46);
  head.writeInt16BE(2, 48);
  head.writeInt16BE(1, 50);
  tables.set('head', head);
  const hhea = Buffer.alloc(36);
  hhea.writeUInt32BE(0x10000);
  hhea.writeInt16BE(800, 4);
  hhea.writeInt16BE(-200, 6);
  hhea.writeInt16BE(100, 8);
  hhea.writeUInt16BE(600, 10);
  hhea.writeInt16BE(550, 16);
  hhea.writeInt16BE(1, 18);
  hhea.writeUInt16BE(count, 34);
  tables.set('hhea', hhea);
  const maxp = Buffer.alloc(32);
  maxp.writeUInt32BE(0x10000);
  maxp.writeUInt16BE(count, 4);
  maxp.writeUInt16BE(4, 6);
  maxp.writeUInt16BE(1, 8);
  maxp.writeUInt16BE(1, 14);
  tables.set('maxp', maxp);
  const os = Buffer.alloc(96);
  os.writeUInt16BE(4);
  os.writeInt16BE(600, 2);
  os.writeUInt16BE(400, 4);
  os.writeUInt16BE(5, 6);
  os.writeUInt16BE(128 | 64, 62);
  os.writeUInt16BE(32, 64);
  os.writeUInt16BE(0xffff, 66);
  os.writeInt16BE(800, 68);
  os.writeInt16BE(-200, 70);
  os.writeInt16BE(100, 72);
  os.writeUInt16BE(800, 74);
  os.writeUInt16BE(200, 76);
  os.writeInt16BE(500, 86);
  os.writeInt16BE(700, 88);
  os.write('ANIM', 58);
  tables.set('OS/2', os);
  const strings = new Map([
    [1, 'Anima Test'],
    [2, 'Regular'],
    [3, 'AnimaTest-1'],
    [4, 'Anima Test Regular'],
    [5, 'Version 1.0'],
    [6, 'AnimaTest-Regular'],
    [256, 'Weight'],
    [257, 'Bold'],
  ]);
  const records: Buffer[] = [],
    text: Buffer[] = [];
  let length = 0;
  for (const [id, value] of strings) {
    const raw = Buffer.from(value, 'utf16le').swap16(),
      r = Buffer.alloc(12);
    r.writeUInt16BE(3);
    r.writeUInt16BE(1, 2);
    r.writeUInt16BE(0x409, 4);
    r.writeUInt16BE(id, 6);
    r.writeUInt16BE(raw.length, 8);
    r.writeUInt16BE(length, 10);
    records.push(r);
    text.push(raw);
    length += raw.length;
  }
  const name = Buffer.alloc(6);
  name.writeUInt16BE(records.length, 2);
  name.writeUInt16BE(6 + records.length * 12, 4);
  tables.set('name', Buffer.concat([name, ...records, ...text]));
  const post = Buffer.alloc(32);
  post.writeUInt32BE(0x30000);
  tables.set('post', post);
  // Request smoothing without grid fitting: auto-hinting must not change test advances.
  tables.set('gasp', Buffer.from([0, 1, 0, 1, 255, 255, 0, 10]));
  const hmtx = Buffer.alloc(count * 4),
    loca = Buffer.alloc((count + 1) * 4),
    glyphs: Buffer[] = [];
  let offset = 0;
  for (let id = 0; id < count; id++) {
    hmtx.writeUInt16BE(id === 1 ? 300 : 600, id * 4);
    hmtx.writeInt16BE(id === 1 ? 0 : 50, id * 4 + 2);
    loca.writeUInt32BE(offset, id * 4);
    if (id !== 1) {
      const width = 400 + (id % 4) * 25;
      const cp = chars[id - 1] ?? 0;
      const height = cp >= 97 && cp <= 122 ? 500 : 700;
      let raw = encodeGlyph([
        [
          { x: 50, y: 0, on: true },
          { x: 50 + width, y: 0, on: true },
          { x: 50 + width, y: height, on: true },
          { x: 50, y: height, on: true },
        ],
      ]);
      if (raw.length % 2) raw = Buffer.concat([raw, Buffer.alloc(1)]);
      glyphs.push(raw);
      offset += raw.length;
    }
  }
  loca.writeUInt32BE(offset, count * 4);
  tables.set('hmtx', hmtx);
  tables.set('loca', loca);
  tables.set('glyf', Buffer.concat(glyphs));
  const coverage = new Map(chars.map((cp, i) => [cp, i + 1]));
  tables.set('cmap', cmap12(coverage));
  const kern = Buffer.alloc(24);
  kern.writeUInt16BE(1, 2);
  kern.writeUInt16BE(20, 6);
  kern.writeUInt16BE(1, 8);
  kern.writeUInt16BE(1, 10);
  kern.writeUInt16BE(6, 12);
  kern.writeUInt16BE(coverage.get(65)!, 18);
  kern.writeUInt16BE(coverage.get(86)!, 20);
  kern.writeInt16BE(-100, 22);
  tables.set('kern', kern);
  const fvar = Buffer.alloc(44);
  fvar.writeUInt32BE(0x10000);
  fvar.writeUInt16BE(16, 4);
  fvar.writeUInt16BE(2, 6);
  fvar.writeUInt16BE(1, 8);
  fvar.writeUInt16BE(20, 10);
  fvar.writeUInt16BE(1, 12);
  fvar.writeUInt16BE(8, 14);
  fvar.write('wght', 16);
  fvar.writeInt32BE(100 * 65536, 20);
  fvar.writeInt32BE(400 * 65536, 24);
  fvar.writeInt32BE(900 * 65536, 28);
  fvar.writeUInt16BE(256, 34);
  fvar.writeUInt16BE(257, 36);
  fvar.writeInt32BE(700 * 65536, 40);
  tables.set('fvar', fvar);
  // One tuple per nonempty glyph: at wght=900 the two right corners move +100.
  const gvarParts: Buffer[] = [],
    gvarOffsets = Buffer.alloc((count + 1) * 4);
  let gsize = 0;
  for (let id = 0; id < count; id++) {
    gvarOffsets.writeUInt32BE(gsize, id * 4);
    if (id === 1) continue;
    const data = Buffer.from([7, 0, 100, 100, 0, 0, 0, 0, 0, 0x87]); // 8 x deltas + 8 zero y deltas, includes phantom points
    const h = Buffer.alloc(10);
    h.writeUInt16BE(1);
    h.writeUInt16BE(10, 2);
    h.writeUInt16BE(data.length, 4);
    h.writeUInt16BE(0x8000, 6);
    h.writeInt16BE(16384, 8);
    const part = Buffer.concat([h, data]);
    gvarParts.push(part);
    gsize += part.length;
  }
  gvarOffsets.writeUInt32BE(gsize, count * 4);
  const gvar = Buffer.alloc(20);
  gvar.writeUInt32BE(0x10000);
  gvar.writeUInt16BE(1, 4);
  gvar.writeUInt32BE(20 + gvarOffsets.length, 8);
  gvar.writeUInt16BE(count, 12);
  gvar.writeUInt16BE(1, 14);
  gvar.writeUInt32BE(20 + gvarOffsets.length, 16);
  tables.set('gvar', Buffer.concat([gvar, gvarOffsets, ...gvarParts]));
  return sfnt(tables);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = new URL('../fixtures/fonts/anima-test.ttf', import.meta.url);
  mkdirSync(new URL('.', out), { recursive: true });
  writeFileSync(out, testFont());
  console.log(fileURLToPath(out));
}
