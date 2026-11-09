import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import type { DrawNode } from '../../../../packages/core/src/draw.ts';
import { boundsScales, paintedBounds } from '../../core/bounds.ts';
import { runtime } from '../../core/runtime.ts';
const id = [1, 0, 0, 1, 0, 0] as const;
function player(nodes: object[], requires = ['composite'], extra = {}) {
  const result = load({
    anima: '0.1',
    name: 'extents',
    grid: 100,
    requires: ['a11y', ...requires],
    nodes,
    ...extra,
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
}
const rect = (id: string, extra = {}) => ({
  id,
  type: 'rect',
  x0: 0,
  y0: 0,
  w: 20,
  h: 10,
  fill: { color: '#000' },
  ...extra,
});
it('fixed stroke conformance covers two host scales without changing the model or outline', () => {
  const root = new URL('../../../../spec/conformance/a11y-tree-bounds-fixed/', import.meta.url);
  const p = new Player(load(readFileSync(new URL('case.ani', root), 'utf8')).model!);
  const cases = JSON.parse(readFileSync(new URL('host-sizes.json', root), 'utf8')) as {
    size: number;
    bounds: number[];
    expected: string;
  }[];
  for (const { size, bounds, expected } of cases) {
    boundsScales.set(p, [size / 100, size / 100]);
    runtime.caches.delete(p);
    expect(p.semantics()[0]!.bounds).toEqual(bounds);
    expect(p.semantics()).toEqual(
      JSON.parse(readFileSync(new URL(expected, root), 'utf8')).semantics,
    );
  }
});
it('clips ignore source paint/visibility/compositing and preserve explicit boxes', () => {
  const p = player([
    rect('a', { clip: { source: 'b' }, a11y: { role: 'img' } }),
    rect('explicit', { clip: { source: 'b' }, a11y: { role: 'img', bounds: [0, 0, 30, 30] } }),
    rect('b', {
      x: 5,
      w: 5,
      visible: false,
      fill: { color: '#000' },
      stroke: { color: '#000', width: 8 },
      clip: { source: 'c' },
    }),
    rect('c', { x: 50 }),
  ]);
  expect(p.semantics().map((n) => n.bounds)).toEqual([
    [5, 0, 5, 10],
    [0, 0, 30, 30],
  ]);
});
it('mask sources ignore ancestor visibility but honor their own, and inverted masks retain outside support', () => {
  const p = player([
    rect('a', {
      mask: { source: 'source', mode: 'alpha', sourceDraws: false },
      a11y: { role: 'img' },
    }),
    rect('inverted', {
      mask: { source: 'source', mode: 'inverted-alpha', sourceDraws: false },
      a11y: { role: 'img' },
    }),
    { id: 'hidden', type: 'group', x: 5, visible: false, children: [rect('source', { w: 5 })] },
  ]);
  expect(p.semantics().map((n) => n.bounds)).toEqual([
    [5, 0, 5, 10],
    [0, 0, 20, 10],
  ]);
});
it('source animation invalidates a settled semantic cache', () => {
  const p = player(
    [rect('a', { clip: { source: 'b' }, a11y: { role: 'img' } }), rect('b', { w: 5 })],
    ['composite'],
    {
      timelines: {
        move: {
          duration: 1,
          tracks: {
            'b.x': [
              [0, 0],
              [1, 10],
            ],
          },
        },
      },
      machine: { layers: { main: { initial: 'run', states: { run: { play: 'move' } } } } },
    },
  );
  const before = p.semantics();
  p.step(1);
  expect(p.semantics()[0]!.bounds).toEqual([10, 0, 5, 10]);
  expect(p.semantics()).not.toBe(before);
});
it('fixed round circles and nonuniform viewport strokes keep their numeric width', () => {
  const n: DrawNode = {
    transform: [...id],
    visible: true,
    opacity: 1,
    geometry: { kind: 'circle', cx: 0, cy: 0, r: 2 },
    paints: [{ kind: 'stroke' as const, visible: true, width: 2, scale: 'fixed' }],
  };
  expect(paintedBounds(n, [3, 0, 0, 2, 10, 20], [2, 4])).toEqual([3.5, 15.75, 13, 8.5]);
});
it('mask source bounds include their own clip and an unpainted source contributes no mask paint', () => {
  const p = player([
    rect('a', {
      mask: { source: 'source', mode: 'alpha', sourceDraws: false },
      a11y: { role: 'img' },
    }),
    rect('source', { clip: { source: 'edge' } }),
    rect('edge', { x: 7, w: 3 }),
    { id: 'empty', type: 'rect', x0: 0, y0: 0, w: 20, h: 10 },
    rect('b', {
      mask: { source: 'empty', mode: 'alpha', sourceDraws: false },
      a11y: { role: 'img' },
    }),
  ]);
  expect(p.semantics().map((n) => n.bounds)).toEqual([
    [7, 0, 3, 10],
    [0, 0, 0, 0],
  ]);
});
