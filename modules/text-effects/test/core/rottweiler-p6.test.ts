// Rottweiler P6 regressions (design/rottweiler/P6-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, drawFrame } from '@anima-format/core';
import { registerTextMeasurer } from '../../../text/core/index.ts';
import { fixedMeasurer } from '../../../text/test/core/measurer.ts';
import type { EffectDrawing, EffectCluster } from '../../core/index.ts';
import type { TextDrawNode } from '../../../text/core/index.ts';
const shifts = (timelines?: object) => {
  registerTextMeasurer(fixedMeasurer);
  const r = load({
    anima: '0.1',
    name: 'effects',
    grid: 20,
    requires: ['text', 'texteffects'],
    nodes: [
      { id: 'label', type: 'text', runs: [{ id: 'first', text: 'ab' }], effects: [{ x: 5 }] },
    ],
    ...(timelines ? { timelines } : {}),
  });
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  const data = (drawFrame(p).nodes[0] as TextDrawNode).text as EffectDrawing;
  return data.layout.lines.flatMap((l) => l.clusters as EffectCluster[]).map((c) => c.matrix[4]);
};
it('R1-08: an unplayed timeline on an omitted range end keeps the unbounded default', () => {
  const rest = shifts();
  expect(rest).toEqual([5, 5]);
  expect(
    shifts({
      t: {
        duration: 1,
        tracks: {
          'label.effects.0.end': [
            [0, 1],
            [1, 2],
          ],
        },
      },
    }),
  ).toEqual(rest);
});
