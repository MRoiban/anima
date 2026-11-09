import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, toSVG } from '../../../../packages/core/src/index.ts';
export const scene = {
  anima: '0.1',
  name: 'switch',
  grid: 20,
  requires: ['corners'],
  nodes: [
    {
      id: 'track',
      type: 'rect',
      x0: 1,
      y0: 5,
      w: 18,
      h: 10,
      corners: [5, 5, 5, 5],
      fill: { color: '#123456' },
    },
  ],
  timelines: {
    t: {
      duration: 1,
      tracks: {
        'track.corners.0': [
          [0, 0],
          [1, 5],
        ],
      },
    },
  },
  machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
};
it('renders and animates corners with only corners declared (#30)', () => {
  const r = load(scene);
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  p.step(0.5);
  expect(p.value('track.corners.0')).toBe(2.5);
  expect(toSVG(p)).toContain('<path');
});
it('preserves the paint-only geometry byte for byte and allows both declarations', () => {
  const a = new Player(load(scene).model!);
  const b = new Player(load({ ...scene, requires: ['paint'] }).model!);
  const c = new Player(load({ ...scene, requires: ['paint', 'corners'] }).model!);
  for (const dt of [0, 0.5, 0.5]) {
    a.step(dt);
    b.step(dt);
    c.step(dt);
    expect(toSVG(a)).toBe(toSVG(b));
    expect(toSVG(a)).toBe(toSVG(c));
  }
});
it('rejects malformed/undeclared corners with the existing diagnostics', () => {
  const d = structuredClone(scene);
  d.nodes[0]!.corners = [1, -1, 0, 0];
  expect(load(d).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'bad-value', pointer: '/nodes/0/corners/1' }),
  );
  expect(load({ ...scene, requires: [] }).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'undeclared-feature', pointer: '/nodes/0/corners' }),
  );
});
