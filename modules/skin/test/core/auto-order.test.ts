import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { drawFrame, load, Player } from '@anima-format/core';

// Rottweiler S2-2: automatic weights must not depend on whether values() or drawing runs first.
it('gives rounded contours the same automatic weights whichever API runs first', () => {
  const result = load({
    anima: '0.1',
    name: 'auto-order',
    grid: 20,
    requires: ['contour', 'paint', 'rig', 'skin'],
    nodes: [
      { id: 'a', type: 'bone', x: 0, y: 0, length: 5 },
      { id: 'b', type: 'bone', x: 5, y: 0, length: 5 },
      {
        id: 'shape',
        type: 'contour',
        closed: true,
        fill: { color: '#000' },
        vertices: [
          { point: [0, 0], kind: 'rounded', radius: 1 },
          { point: [10, 0], kind: 'rounded', radius: 1 },
          { point: [10, 2], kind: 'rounded', radius: 1 },
          { point: [0, 2], kind: 'rounded', radius: 1 },
        ],
        skin: { bones: ['a', 'b'] },
      },
    ],
    timelines: {
      bend: {
        duration: 1,
        tracks: {
          'b.rotate': [
            [0, 0],
            [1, 90],
          ],
        },
      },
    },
    machine: { layers: { main: { initial: 'bend', states: { bend: { play: 'bend' } } } } },
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const first = new Player(result.model!),
    second = new Player(result.model!);
  first.values();
  first.step(1);
  second.step(1);
  const shape = (p: Player) => drawFrame(p).nodes.find((n) => n.geometry?.d)!.geometry!.d;
  expect(shape(second)).toBe(shape(first));
});
