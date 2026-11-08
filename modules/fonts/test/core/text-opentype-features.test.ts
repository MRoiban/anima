import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { compile } from '../../../../packages/markup/src/index.ts';
import { ToolMeasurer, type FontSpec } from '../../../../packages/cli/src/font/measure.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { featuresFont } from '../features-font.ts';
import { substitute } from '../../../../packages/cli/src/font/features.ts';
const spec: FontSpec = { family: 'body', size: 10, weight: 400, style: 'normal', tracking: 0 };
it('makes OpenType settings authorable and applies real single/ligature substitutions to measurement and outlines', () => {
  const built = compile(
    `<anima version="0.1" name="features" grid="20" requires="text fonts"><text id="label"><style id="s" features='{"liga":0,"tnum":1}'/><run text="fi1" style="s"/></text></anima>`,
  );
  expect(built.diagnostics).toEqual([]);
  const font = new Font(featuresFont()),
    tool = new ToolMeasurer();
  tool.register('body', font);
  expect(substitute(font, 'fi1').map((g) => g.glyph)).toEqual([font.glyph(87), font.glyph(49)]);
  expect(substitute(font, 'fi1', { liga: 0, tnum: 1 }).map((g) => g.glyph)).toEqual([
    font.glyph(102),
    font.glyph(105),
    font.glyph(65),
  ]);
  expect([...tool.measure(spec, 'fi1').advances]).toEqual([6, 6, 12]);
  expect([...tool.measure({ ...spec, features: { liga: 0 } }, 'fi1').advances]).toEqual([
    6, 12, 18,
  ]);
  expect(tool.outline({ ...spec, features: { tnum: 1 } }, '1')).toBe(tool.outline(spec, 'A'));
});
it('disables real pair kerning and reports unsupported font feature tags', () => {
  const tool = new ToolMeasurer();
  tool.register('body', new Font(featuresFont()));
  expect(tool.measure(spec, 'AV').advances.at(-1)).toBe(11);
  expect(tool.measure({ ...spec, features: { kern: 0 } }, 'AV').advances.at(-1)).toBe(12);
  const diagnostics: unknown[] = [];
  tool.onDiagnostic = (d) => diagnostics.push(d);
  tool.measure({ ...spec, features: { nope: 1 } }, 'A');
  expect(diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'font-feature',
      pointer: '/features/nope',
      hint: expect.any(String),
    }),
  );
});
