// Rottweiler P6 regressions (design/rottweiler/P6-LEDGER.md), measured with the kerned test font.
import { beforeEach, expect, it } from 'vitest';
import { layoutText, type LayoutInput } from '../../core/layout.ts';
import { registerTextMeasurer } from '../../core/measure.ts';
import { overflowText } from '../../core/overflow.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { ToolMeasurer } from '../../../../packages/cli/src/font/measure.ts';
import { testFont } from '../../../../tools/test-font.ts';
const tool = new ToolMeasurer();
tool.register('T', new Font(testFont()));
beforeEach(() => registerTextMeasurer(tool));
const lay = (text: string, extra: Partial<LayoutInput>, style = {}) =>
  layoutText(
    { runs: [{ text, style: 's' }], styles: { s: { font: 'T', size: 20, ...style } }, ...extra },
    overflowText,
  );
it('R1-02: a soft-wrapped line start drops the kerning measured against the previous line', () => {
  // The test font kerns "AV" (12 + 10); standalone "V" is 12 wide.
  const l = lay('AV', { sizing: 'auto-height', width: 12, wordBreak: 'break-all' });
  expect(l.lines.map((x) => x.width)).toEqual([12, 12]);
  expect(l.lines[1]!.clusters[0]!.advance).toBe(12);
});
it('R1-03: font-size fitting with no fitting size reports no lines without a zero-size font', () => {
  const l = lay(
    'AV',
    { sizing: 'fixed', width: 1, height: 10, wrap: false, overflow: 'fit-font-size' },
    { tracking: 10 },
  );
  expect(l.lines).toEqual([]);
  expect([l.fittedSize, l.contentWidth, l.contentHeight]).toEqual([0, 0, 0]);
});
it('R1-04: hidden overflow tests line fit after the top trim', () => {
  // ascent 16, descent 4, cap 14: the cap-trimmed line ends at 14 + 4 = 18.
  const hidden = (verticalTrimTop?: 'cap') =>
    lay('A', { sizing: 'fixed', width: 100, height: 18, overflow: 'hidden', verticalTrimTop });
  expect(hidden().lines).toHaveLength(0);
  expect(hidden('cap').lines.map((x) => x.baseline)).toEqual([14]);
});
it('R2-01: soft-wrapped lines measure their own fragments, so ligatures neither split nor vanish', async () => {
  const { featuresFont } = await import('../../../fonts/test/features-font.ts');
  const { sfnt } = await import('../../../../packages/cli/src/font/binary.ts');
  const font = new Font(featuresFont());
  // The synthetic font substitutes fi → W; widen W so the ligature (9) differs from f + i (6 + 6).
  font.tables.get('hmtx')!.writeUInt16BE(900, font.glyph('W'.codePointAt(0)!) * 4);
  const measurer = new ToolMeasurer();
  measurer.register('L', new Font(sfnt(font.tables)));
  registerTextMeasurer(measurer);
  const widths = (text: string) =>
    layoutText(
      {
        runs: [{ text, style: 's' }],
        styles: { s: { font: 'L', size: 10 } },
        sizing: 'auto-height',
        width: 7,
        wordBreak: 'break-all',
      },
      overflowText,
    ).lines.map((l) => [l.clusters.map((c) => c.text).join(''), l.width]);
  expect(widths('fi')).toEqual([
    ['f', 6],
    ['i', 6],
  ]);
  expect(widths('afi')).toEqual([
    ['a', 6],
    ['fi', 9],
  ]);
});
