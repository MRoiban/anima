// Rottweiler P6 regressions (design/rottweiler/P6-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { registerTextMeasurer } from '../../../text/core/measure.ts';
import { fixedMeasurer } from '../../../text/test/core/measurer.ts';
it('R4-05: text semantic bounds place an empty line at its aligned, origin-shifted start', () => {
  registerTextMeasurer(fixedMeasurer);
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'empty-line',
    grid: 20,
    requires: ['text', 'a11y'],
    nodes: [
      {
        id: 'q',
        type: 'text',
        width: 10,
        height: 4,
        runs: [{ text: 'A\n' }],
        align: 'right',
        origin: [0.5, 0],
        a11y: { role: 'text' },
      },
    ],
  });
  expect(diagnostics).toEqual([]);
  const p = new Player(model!);
  p.step(0);
  // "A" spans 4..5 and the empty line starts at 5: not stretched back to x = 0.
  expect(p.semantics()[0]!.bounds).toEqual([4, 0, 1, 2]);
});
