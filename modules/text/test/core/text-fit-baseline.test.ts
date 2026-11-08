import '@anima-format/core/all';
import { beforeEach, expect, it } from 'vitest';
import { load } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
import { layoutText, type LayoutInput } from '../../core/layout.ts';
import { registerTextMeasurer } from '../../core/measure.ts';
import { ToolMeasurer } from '../../../../packages/cli/src/font/measure.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { testFont } from '../../../../tools/test-font.ts';
const measurer = new ToolMeasurer();
measurer.register('sans-serif', new Font(testFont()));
beforeEach(() => registerTextMeasurer(measurer));
const layout = (extra: Partial<LayoutInput> = {}) =>
  layoutText({
    runs: [{ text: 'abcdefgh', style: 's' }],
    styles: { s: { size: 1 } },
    sizing: 'fixed',
    width: 4,
    height: 4,
    wrap: false,
    lineHeight: 1,
    ...extra,
  });
it('finds the maximal continuous font-size fit and reports exactly the fitted box', () => {
  const fitted = layout({ overflow: 'fit-font-size', fitFontSizeResizesBox: true });
  // Original font: eight 600/1000-em advances. The maximal size is 4/4.8 = 5/6.
  expect(fitted.fittedSize).toBeCloseTo(5 / 6, 6);
  expect(fitted.width).toBeCloseTo(4, 5);
  expect(fitted.height).toBeCloseTo(5 / 6, 6);
  expect(fitted.lines[0]!.baseline).toBeCloseTo((5 / 6) * 0.8, 6);
  expect(fitted.width).toBe(fitted.contentWidth);
  expect(fitted.height).toBe(fitted.contentHeight);
  const enlarged = layout({ styles: { s: { size: fitted.fittedSize + 1e-6 } } });
  expect(enlarged.contentWidth).toBeGreaterThan(4);
});
it('fits the distance below the first baseline, independent of the first ascent', () => {
  const fitted = layout({
    runs: [{ text: 'abcd' }],
    height: 0.2,
    overflow: 'fit-font-size',
    fitFromBaseline: true,
  });
  expect(fitted.fittedSize).toBe(1);
  expect(fitted.contentHeight - fitted.lines[0]!.baseline).toBeCloseTo(0.2, 12);
  const full = layout({
    runs: [{ text: 'abcd' }],
    height: 0.2,
    overflow: 'fit-font-size',
    fitFromBaseline: false,
  });
  expect(full.fittedSize).toBeCloseTo(0.2, 6);
});
it('retains the maximal grapheme prefix and one typographic ellipsis, with its measured advance', () => {
  const out = layout({ overflow: 'ellipsis' });
  expect(out.lines[0]!.clusters.map((c) => c.text).join('')).toBe('abcde…');
  expect(out.lines[0]!.width).toBeCloseTo(3.6, 12);
  expect(out.lines[0]!.clusters.at(-1)).toMatchObject({ text: '…', x: 3, advance: 0.6, index: 5 });
});
it('trims to actual cap/x-height and baseline metrics rather than preserving untrimmed drawing', () => {
  const cap = layout({ verticalTrimTop: 'cap', verticalTrimBottom: 'baseline' });
  expect(cap.lines[0]!.baseline).toBeCloseTo(0.7, 12);
  expect(cap.contentHeight).toBeCloseTo(0.7, 12);
  const ex = layout({ verticalTrimTop: 'x-height', verticalTrimBottom: 'baseline' });
  expect(ex.lines[0]!.baseline).toBeCloseTo(0.5, 12);
  expect(ex.contentHeight).toBeCloseTo(0.5, 12);
});
it('keeps both spellings and actionable box diagnostics for the retained geometry contract', () => {
  const compiled = compile(`<anima version="0.1" name="fit" grid="20" requires="text">
    <text id="t" sizing="fixed" width="4" height="1" overflow="fit-font-size" fit-from-baseline="true" fit-font-size-resizes-box="true" vertical-trim-top="cap" vertical-trim-bottom="baseline"><run text="abcd"/></text>
  </anima>`);
  expect(compiled.diagnostics).toEqual([]);
  expect(compile(decompile(compiled.text!)).doc).toEqual(compiled.doc);
  const bad = structuredClone(compiled.doc!);
  delete (bad.nodes as Record<string, unknown>[])[0]!.width;
  expect(load(bad).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'text-box',
      pointer: '/nodes/0/sizing',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
