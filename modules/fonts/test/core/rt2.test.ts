import { expect, it } from 'vitest';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { sfnt } from '../../../../packages/cli/src/font/binary.ts';
import { decodeFont } from '../../core/info.ts';
import { testFont } from '../../../../tools/test-font.ts';
const base = new Font(testFont());
/** A GPOS kern pair lookup (format 1, value -75) with lookup flags, and GDEF classes base/base. */
function kernFont(flags: number, classes = [1, 1]) {
  const left = base.glyph(65),
    right = base.glyph(86),
    pair = Buffer.alloc(24);
  pair.writeUInt16BE(1);
  pair.writeUInt16BE(18, 2);
  pair.writeUInt16BE(4, 4);
  pair.writeUInt16BE(1, 8);
  pair.writeUInt16BE(12, 10);
  pair.writeUInt16BE(1, 12);
  pair.writeUInt16BE(right, 14);
  pair.writeInt16BE(-75, 16);
  pair.writeUInt16BE(1, 18);
  pair.writeUInt16BE(1, 20);
  pair.writeUInt16BE(left, 22);
  const header = Buffer.alloc(10);
  header.writeUInt32BE(0x10000);
  header.writeUInt16BE(10, 4);
  header.writeUInt16BE(12, 6);
  header.writeUInt16BE(26, 8);
  const feature = Buffer.alloc(14);
  feature.writeUInt16BE(1);
  feature.write('kern', 2);
  feature.writeUInt16BE(8, 6);
  feature.writeUInt16BE(1, 10);
  const lookups = Buffer.from([0, 1, 0, 4, 0, 2, 0, flags, 0, 1, 0, 8]);
  // GDEF 1.0 with a format-2 glyph class definition: left and right are separate ranges.
  const gdef = Buffer.alloc(30);
  gdef.writeUInt32BE(0x10000);
  gdef.writeUInt16BE(12, 4);
  gdef.writeUInt16BE(2, 12);
  gdef.writeUInt16BE(2, 14);
  const ranges = [
    [left, classes[0]!],
    [right, classes[1]!],
  ].sort((a, b) => a[0]! - b[0]!);
  ranges.forEach(([g, c], k) => {
    gdef.writeUInt16BE(g!, 16 + k * 6);
    gdef.writeUInt16BE(g!, 18 + k * 6);
    gdef.writeUInt16BE(c!, 20 + k * 6);
  });
  const tables = new Map(base.tables);
  tables.delete('kern');
  tables.set('GPOS', Buffer.concat([header, Buffer.alloc(2), feature, lookups, pair]));
  tables.set('GDEF', gdef);
  return { font: new Font(sfnt(tables)), left, right };
}
it('R2-4: GPOS ignore flags skip pairs with an ignored GDEF glyph class', () => {
  const k = (flags: number, classes?: number[]) => {
    const { font, left, right } = kernFont(flags, classes);
    return font.kerning(left, right);
  };
  expect(k(0)).toBe(-75);
  expect(k(2)).toBe(0); // IgnoreBaseGlyphs, both are bases
  expect(k(8)).toBe(-75); // IgnoreMarks, neither is a mark
  expect(k(8, [1, 3])).toBe(0); // IgnoreMarks, right is a mark
  expect(k(4, [2, 1])).toBe(0); // IgnoreLigatures, left is a ligature
});
it('R2-3: cmap expansion across repeated subtables is charged to the operation limit', () => {
  const records = 64,
    count = 65535,
    tables = new Map(base.tables);
  const maxp = Buffer.from(tables.get('maxp')!);
  maxp.writeUInt16BE(count, 4);
  tables.set('maxp', maxp);
  const hhea = Buffer.from(tables.get('hhea')!);
  hhea.writeUInt16BE(1, 34);
  tables.set('hhea', hhea);
  tables.set('hmtx', Buffer.alloc(4 + (count - 1) * 2));
  tables.set('loca', Buffer.alloc((count + 1) * 4));
  tables.set('glyf', Buffer.alloc(0));
  for (const t of ['fvar', 'gvar', 'avar', 'GPOS', 'GSUB', 'GDEF', 'kern']) tables.delete(t);
  // Distinct format-12 subtables, each mapping U+0001..U+FFFE.
  const cmap = Buffer.alloc(4 + records * 36);
  cmap.writeUInt16BE(records, 2);
  for (let i = 0; i < records; i++) {
    const p = 4 + records * 8 + i * 28;
    cmap.writeUInt16BE(3, 4 + i * 8);
    cmap.writeUInt16BE(10, 6 + i * 8);
    cmap.writeUInt32BE(p, 8 + i * 8);
    cmap.writeUInt16BE(12, p);
    cmap.writeUInt32BE(28, p + 4);
    cmap.writeUInt32BE(1, p + 12);
    cmap.writeUInt32BE(1, p + 16);
    cmap.writeUInt32BE(65534, p + 20);
    cmap.writeUInt32BE(1, p + 24);
  }
  tables.set('cmap', cmap);
  expect(() => decodeFont(sfnt(tables))).toThrow(expect.objectContaining({ code: 'font-limit' }));
  // A single subtable of the same range still decodes.
  const one = Buffer.from(cmap.subarray(0, 4 + 8));
  one.writeUInt16BE(1, 2);
  one.writeUInt32BE(12, 8);
  tables.set('cmap', Buffer.concat([one, cmap.subarray(4 + records * 8, 4 + records * 8 + 28)]));
  expect(decodeFont(sfnt(tables)).hasGlyph(65534)).toBe(true);
});
