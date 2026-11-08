import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, toSVG } from '../../../../packages/core/src/index.ts';

// Rottweiler P5 R4-03: each ordered paint entry renders only its own paint (SPEC ordered paints).
it('does not leak an earlier stroke entry into a later fill entry', () => {
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'ordered',
    grid: 24,
    requires: ['composite'],
    nodes: [
      {
        id: 'r',
        type: 'rect',
        x0: 4,
        y0: 4,
        w: 16,
        h: 16,
        paints: [{ stroke: { color: '#ff0000', width: 4 } }, { fill: { color: '#0000ff' } }],
      },
    ],
  });
  expect(diagnostics).toEqual([]);
  const rects = [...toSVG(new Player(model!)).matchAll(/<rect [^>]*>/g)].map((m) => m[0]);
  expect(rects).toHaveLength(2);
  expect(rects[0]).toContain('stroke="#ff0000"');
  expect(rects[1]).toContain('fill="#0000ff"');
  expect(rects[1]).not.toContain('stroke=');
});
