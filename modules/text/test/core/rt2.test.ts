import { expect, it } from 'vitest';
import { layoutText } from '../../core/layout.ts';
import { registerTextMeasurer } from '../../core/measure.ts';
import { ToolMeasurer } from '../../../../packages/cli/src/font/measure.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { testFont } from '../../../../tools/test-font.ts';
it('R2-6: fit-font-size with no fitting candidate reports zero without measuring size zero', () => {
  const m = new ToolMeasurer();
  m.register('test', new Font(testFont()));
  registerTextMeasurer(m);
  const fit = (width: number) =>
    layoutText({
      runs: [{ text: 'AB' }],
      styles: { '': { font: 'test', size: 1 } },
      sizing: 'fixed',
      width,
      height: 1,
      overflow: 'fit-font-size',
    } as never);
  expect(fit(1).fittedSize).toBeGreaterThan(0);
  const tiny = fit(1e-7);
  expect(tiny.fittedSize).toBe(0);
  expect(tiny.lines).toEqual([]);
  expect([tiny.contentWidth, tiny.contentHeight]).toEqual([0, 0]);
});
