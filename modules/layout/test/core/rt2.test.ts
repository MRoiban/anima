import '../../../../packages/core/src/all.ts';
import { expect, it } from 'vitest';
import { drawFrame, load, Player } from '../../../../packages/core/src/index.ts';
import { flatten, parsePath } from '../../../../packages/core/src/path.ts';
it('R2-2: a per-corner rect participant draws, hits and bounds its allocated box', () => {
  const r = load({
    anima: '0.1',
    name: 'round-layout',
    grid: 100,
    requires: ['layout', 'paint', 'a11y'],
    nodes: [
      {
        id: 'root',
        type: 'layout',
        width: 50,
        height: 20,
        children: [
          {
            id: 'tile',
            type: 'rect',
            x0: 10,
            y0: 10,
            w: 2,
            h: 2,
            corners: [0.5, 0.5, 0.5, 0.5],
            fill: { color: '#000' },
            layout: { width: 'fill', height: 'fill' },
            a11y: { role: 'button' },
          },
        ],
      },
    ],
    listeners: [{ on: 'down', target: 'tile', emit: 'hit' }],
  });
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  const d = drawFrame(p).nodes[1]!.geometry!.d!;
  const xs = flatten(parsePath(d)).flatMap((s) => s.pts.filter((_, k) => k % 2 === 0)),
    ys = flatten(parsePath(d)).flatMap((s) => s.pts.filter((_, k) => k % 2 === 1));
  expect([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]).toEqual([
    0, 0, 50, 20,
  ]);
  expect(p.hits(p.model.listeners[0]!, 25, 10)).toBe(true);
  expect(p.hits(p.model.listeners[0]!, 55, 10)).toBe(false);
  expect(p.semantics()[0]!.bounds).toEqual([0, 0, 50, 20]);
  // Without layout the authored geometry is unchanged.
  const plain = load({
    anima: '0.1',
    name: 'round',
    grid: 100,
    requires: ['paint'],
    nodes: [
      { id: 'tile', type: 'rect', x0: 10, y0: 10, w: 2, h: 2, corners: [0.5, 0.5, 0.5, 0.5] },
    ],
  });
  const q = new Player(plain.model!);
  q.step(0);
  expect(drawFrame(q).nodes[0]!.geometry!.d).toMatch(/^M10 10\.5/);
});
