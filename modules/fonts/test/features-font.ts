// Original fixture only, adding a tiny DFLT liga (fi→W) + tnum (1→A) GSUB table in memory.
import { testFont } from '../../../tools/test-font.ts';
import { Font } from '../../../packages/cli/src/font/reader.ts';
import { sfnt } from '../../../packages/cli/src/font/binary.ts';
const words = (...values: number[]) => {
  const b = Buffer.alloc(values.length * 2);
  values.forEach((v, i) => b.writeUInt16BE(v, i * 2));
  return b;
};
export function featuresFont() {
  const font = new Font(testFont());
  const glyph = (s: string) => font.glyph(s.codePointAt(0)!);
  const ligature = words(1, 8, 1, 14, 1, 1, glyph('f'), 1, 4, glyph('W'), 2, glyph('i'));
  const single = words(2, 8, 1, glyph('A'), 1, 1, glyph('1'));
  const lookup = (kind: number, sub: Buffer) => Buffer.concat([words(kind, 0, 1, 8), sub]);
  const l1 = lookup(4, ligature),
    l2 = lookup(1, single);
  const lookups = Buffer.concat([words(2, 6, 6 + l1.length), l1, l2]);
  const feature = Buffer.concat([
    words(2),
    Buffer.from('liga'),
    words(14),
    Buffer.from('tnum'),
    words(20),
    words(0, 1, 0),
    words(0, 1, 1),
  ]);
  const script = Buffer.concat([
    words(1),
    Buffer.from('DFLT'),
    words(8),
    words(4, 0),
    words(0, 65535, 2, 0, 1),
  ]);
  const header = words(1, 0, 10, 10 + script.length, 10 + script.length + feature.length);
  font.tables.set('GSUB', Buffer.concat([header, script, feature, lookups]));
  return sfnt(font.tables);
}
