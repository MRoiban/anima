import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { paintedBounds } from '../../core/bounds.ts';
import type { DrawNode } from '../../../../packages/core/src/draw.ts';
const id: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
const node = (d: string, cap = 'butt', join = 'miter'): DrawNode => ({
  transform: id,
  visible: true,
  opacity: 1,
  geometry: { kind: 'path', d },
  paints: [{ kind: 'stroke', visible: true, width: 2, cap, join }],
});
it('uses cubic extrema rather than the control hull or a chord approximation', () => {
  const n = node('M0 0C0 12 12 12 12 0');
  n.paints = [{ kind: 'fill', visible: true }];
  expect(paintedBounds(n, id)).toEqual([0, 0, 12, 9]);
  n.paints = [{ kind: 'stroke', visible: true, width: 2 }];
  expect(paintedBounds(n, id)).toEqual([-1, 0, 14, 10]);
});
it.each([
  ['butt', [0, -1, 10, 2]],
  ['square', [-1, -1, 12, 2]],
  ['round', [-1, -1, 12, 2]],
])('includes %s caps exactly', (cap, box) => {
  expect(paintedBounds(node('M0 0L10 0', cap as string), id)).toEqual(box);
});
it('includes miter joins and bevel fallback at the default miter limit', () => {
  expect(paintedBounds(node('M0 10L0 0L10 0'), id)).toEqual([-1, -1, 11, 11]);
  const sharp = node('M-10 1L0 0L-10 -1');
  expect(paintedBounds(sharp, id)![0]).toBeGreaterThan(-11);
  expect(paintedBounds(sharp, id)![2]).toBeLessThan(11);
});
it('measures transformed circles as ellipses and tracks a changed stroke in cached semantics', () => {
  expect(
    paintedBounds(
      {
        transform: id,
        visible: true,
        opacity: 1,
        geometry: { kind: 'circle', cx: 0, cy: 0, r: 2 },
        paints: [{ kind: 'stroke', width: 2, visible: true }],
      },
      [1, 1, -1, 1, 5, 6],
    ),
  ).toEqual([5 - 3 * Math.SQRT2, 6 - 3 * Math.SQRT2, 6 * Math.SQRT2, 6 * Math.SQRT2]);
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'bounds',
    grid: 20,
    requires: ['a11y'],
    nodes: [
      {
        id: 'n',
        type: 'circle',
        center: [5, 5],
        r: 2,
        stroke: { color: '#000', width: 2 },
        a11y: { role: 'button' },
      },
    ],
    machine: { layers: { main: { initial: 'go', states: { go: { play: 'wide' } } } } },
    timelines: {
      wide: {
        duration: 1,
        tracks: {
          'n.stroke.width': [
            [0, 2],
            [1, 4],
          ],
        },
      },
    },
  });
  expect(diagnostics).toEqual([]);
  const p = new Player(model!);
  p.step(0);
  expect(p.semantics()[0]!.bounds).toEqual([2, 2, 6, 6]);
  p.step(1);
  expect(p.semantics()[0]!.bounds).toEqual([1, 1, 8, 8]);
});
