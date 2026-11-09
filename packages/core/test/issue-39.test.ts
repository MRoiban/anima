import { expect, it } from 'vitest';
import { load, Player, toSVG } from '../src/index.ts';

it('does not repeat a non-wrapping trimmed round stroke at the far endpoint', () => {
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'f9',
    grid: 14,
    viewBox: [0, 0, 14, 14],
    nodes: [
      {
        id: 'check',
        type: 'path',
        d: 'M2 7L5.5 10.5L12 3.5',
        fill: { color: '#00000000' },
        stroke: {
          color: 'currentColor',
          width: 1.7,
          cap: 'round',
          trimEnd: 0.6334486808633097,
        },
      },
      {
        id: 'slash',
        type: 'path',
        d: 'M1.5 1.5L10.5 10.5',
        fill: { color: '#00000000' },
        stroke: { color: 'currentColor', width: 1, cap: 'round', trimEnd: 0.4 },
      },
    ],
  });
  expect(diagnostics).toEqual([]);

  const svg = toSVG(new Player(model!));
  expect([...svg.matchAll(/stroke-dasharray="([^"]+)"/g)].map((m) => m[1])).toEqual([
    '9.18642 29.00447',
    '5.09117 25.45584',
  ]);
});
