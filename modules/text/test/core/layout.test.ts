import { beforeEach, expect, it } from 'vitest';
import { layoutText, type LayoutInput } from '../../core/layout.ts';
import { registerTextMeasurer } from '../../core/measure.ts';
import { fixedMeasurer } from './measurer.ts';
beforeEach(() => registerTextMeasurer(fixedMeasurer));
const box = (text: string, extra: Partial<LayoutInput> = {}) =>
  layoutText({ runs: [{ text }], styles: {}, sizing: 'fixed', width: 5, height: 10, ...extra });
const strings = (l: ReturnType<typeof box>) =>
  l.lines.map((l) => l.clusters.map((c) => c.text).join(''));
it('segments graphemes without splitting surrogate pairs, combining marks or ZWJ', () => {
  const l = box('á👩‍👩‍👧‍👦🙂x', { wordBreak: 'break-all', width: 2 });
  expect(strings(l)).toEqual(['á👩‍👩‍👧‍👦', '🙂x']);
  expect(l.lines[1]!.clusters[0]!.index).toBe(13);
});
it('wraps greedily and distinguishes normal, break-word and break-all', () => {
  expect(strings(box('ab cd ef'))).toEqual(['ab cd', ' ef']);
  expect(strings(box('abcdef', { width: 3 }))).toEqual(['abcdef']);
  expect(strings(box('abcdef', { width: 3, wordBreak: 'break-word' }))).toEqual(['abc', 'def']);
  expect(strings(box('ab cd', { width: 3, wordBreak: 'break-all' }))).toEqual(['ab ', 'cd']);
  expect(strings(box('abcdef', { width: 3, wordBreak: 'break-all', wrap: false }))).toEqual([
    'abcdef',
  ]);
});
it('keeps explicit paragraphs including empty and final paragraphs', () => {
  const l = box('a\n\nb\n', { paragraphSpacing: 0.5 });
  expect(strings(l)).toEqual(['a', '', 'b', '']);
  expect(l.contentHeight).toBe(5.5);
});
it('positions horizontal, vertical and normalized origins', () => {
  const l = box('ab', { align: 'center', valign: 'middle', origin: [0.5, 0.5] });
  expect(l.lines[0]!.clusters[0]!.x).toBe(-1);
  expect(l.lines[0]!.baseline).toBeCloseTo(0.3);
  expect(box('ab', { origin: 'baseline' }).lines[0]!.baseline).toBe(0);
  expect(box('ab', { align: 'right', valign: 'bottom' }).lines[0]!.clusters[0]!.x).toBe(3);
});
it('supports auto sizes, line height, tracking and metric trim', () => {
  const input = { runs: [{ text: 'abc', style: 'a' }], styles: { a: { size: 2, tracking: 0.5 } } };
  expect(layoutText(input).width).toBe(7);
  expect(box('abc', { sizing: 'auto-height', width: 2, wordBreak: 'break-all' }).height).toBe(2);
  expect(box('abc', { sizing: 'auto-width', width: 2 }).width).toBe(3);
  expect(box('a\nb', { lineHeight: 2 }).contentHeight).toBe(4);
  expect(
    box('a', { verticalTrimTop: 'cap', verticalTrimBottom: 'baseline' }).contentHeight,
  ).toBeCloseTo(0.7);
});
it('visible, hidden, clipped and ellipsis have distinct policies', () => {
  expect(strings(box('a\nb', { height: 1, overflow: 'visible' }))).toEqual(['a', 'b']);
  expect(strings(box('a\nb', { height: 1, overflow: 'hidden' }))).toEqual(['a']);
  expect(box('ab', { height: 0.5, overflow: 'clipped' }).clip).toEqual([0, 0, 5, 0.5]);
  expect(
    strings(box('abcdef', { width: 3, height: 1, wrap: false, overflow: 'ellipsis' })),
  ).toEqual(['ab…']);
  expect(strings(box('ab\ncd', { width: 3, height: 1, overflow: 'ellipsis' }))).toEqual(['ab…']);
  expect(strings(box('ab', { height: 0, overflow: 'ellipsis' }))).toEqual([]);
});
it('fits by scaling or by font-size bisection and reports reduced dimensions', () => {
  const a = box('abcdef', { width: 3, height: 1, wrap: false, overflow: 'fit' });
  expect(a.scale).toBe(0.5);
  expect(a.lines[0]!.width).toBe(3);
  const b = box('abcdef', {
    width: 3,
    height: 1,
    wrap: false,
    overflow: 'fit-font-size',
    fitFontSizeResizesBox: true,
  });
  expect(b.fittedSize).toBeCloseTo(0.5, 5);
  expect(b.width).toBeCloseTo(3, 5);
  expect(b.height).toBeCloseTo(0.5, 5);
  const c = box('ab', {
    height: 0.2,
    wrap: false,
    overflow: 'fit-font-size',
    fitFromBaseline: true,
  });
  expect(c.fittedSize).toBeCloseTo(1, 5);
});
it('preserves run/cluster identity and offsets across wrap and styles', () => {
  const l = layoutText({
    runs: [
      { text: 'ab', style: 'a' },
      { text: 'cd', style: 'b' },
    ],
    styles: { a: { size: 1 }, b: { size: 2 } },
    sizing: 'auto-height',
    width: 4,
    wordBreak: 'break-all',
  });
  expect(l.lines.map((l) => l.width)).toEqual([4, 2]);
  expect(l.lines[1]!.clusters[0]).toMatchObject({ index: 3, run: 1, font: { size: 2 } });
});
it('keeps a grapheme that crosses a run boundary with the leading run style', () => {
  const l = layoutText({
    runs: [
      { text: 'a', style: 'a' },
      { text: '\u0301b', style: 'b' },
    ],
    styles: { a: { size: 1 }, b: { size: 2 } },
  });
  expect(l.lines[0]!.clusters.map((c) => [c.text, c.run, c.index])).toEqual([
    ['á', 0, 0],
    ['b', 1, 2],
  ]);
  expect(l.width).toBe(3);
});
it('takes line metrics from its own runs rather than a larger first paragraph', () => {
  const l = layoutText({
    runs: [
      { text: 'a\n', style: 'a' },
      { text: 'b', style: 'b' },
    ],
    styles: { a: { size: 2 }, b: { size: 1 } },
  });
  expect(l.lines.map((l) => l.ascent)).toEqual([1.6, 0.8]);
});
it('font-size fitting preserves grid tracking and paragraph spacing', () => {
  const l = layoutText({
    runs: [{ text: 'ab', style: 's' }],
    styles: { s: { size: 2, tracking: 1 } },
    sizing: 'fixed',
    width: 3,
    height: 4,
    overflow: 'fit-font-size',
    wrap: false,
  });
  expect(l.fittedSize).toBeCloseTo(1, 5);
  expect(l.lines[0]!.clusters[1]!.font.tracking).toBe(1);
});
it('anchors the first baseline after fitting, vertical alignment and trimming', () => {
  const l = box('abcd', {
    width: 2,
    height: 4,
    wrap: false,
    overflow: 'fit',
    origin: 'baseline',
    valign: 'middle',
    verticalTrimTop: 'cap',
  });
  expect(l.lines[0]!.baseline).toBeCloseTo(0, 12);
  expect(l.lines[0]!.clusters[0]!.y).toBeCloseTo(0, 12);
  expect(l.scale).toBe(0.5);
});
it('fits the trimmed baseline distance and ignores empty fitting dimensions', () => {
  const trimmed = box('abcd', {
    width: 4,
    height: 0.1,
    wrap: false,
    overflow: 'fit-font-size',
    fitFromBaseline: true,
    verticalTrimTop: 'cap',
  });
  expect(trimmed.fittedSize).toBeCloseTo(0.5, 5);
  const baseline = box('a', {
    width: 4,
    height: 0.1,
    overflow: 'fit',
    fitFromBaseline: true,
    verticalTrimBottom: 'baseline',
  });
  expect(baseline.scale).toBe(1);
  expect(box('', { width: 0.1, height: 2, overflow: 'fit' }).scale).toBe(1);
});
