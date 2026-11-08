import { expect, it } from 'vitest';
import { decodeFont } from '../../core/info.ts';
import { testFont } from '../../../../tools/test-font.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { FontInfo } from '../../core/info.ts';
it('shares derived axes/features and glyph paths with the tool reader without mutating the face', () => {
  const bytes = testFont(),
    f = decodeFont(bytes),
    tool = new Font(bytes),
    derived = f.derive({ axes: { wght: 900 } });
  expect(f.options.axes.wght).toBe(400);
  expect(derived.options.axes.wght).toBe(900);
  const glyph = tool.glyph(65);
  expect(derived.glyphPath(glyph)).toBe(tool.path(glyph, 1000, 0, 0, { wght: 900 }));
  expect(derived.glyphPath(glyph)).not.toBe(f.glyphPath(glyph));
  expect(new FontInfo(tool).derive({ axes: { wght: 900 } }).glyphs('AB')).toEqual(
    derived.glyphs('AB'),
  );
  expect(f.derive({ axes: { wght: 99999 } }).options.axes.wght).toBe(900);
  expect(f.glyphs('AB').map((g) => g.glyph)).toEqual([tool.glyph(65), tool.glyph(66)]);
});
it.each([
  ['font-axis', { axes: { xxxx: 1 } }],
  ['font-axis', { axes: { wght: NaN } }],
  ['font-feature', { features: { kern: -1 } }],
  ['font-feature', { features: { xxxx: 1 } }],
])('rejects invalid derived %s options without changing the source', (code, options) => {
  const f = decodeFont(testFont());
  expect(() => f.derive(options)).toThrow(
    expect.objectContaining({
      code,
      pointer: '',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
  expect(f.options.axes.wght).toBe(400);
});
