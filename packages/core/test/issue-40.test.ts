import { expect, it } from 'vitest';
import { load, Player, toSVG } from '../src/index.ts';

it('preserves tiny nonzero transform matrix entries', () => {
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'f10',
    grid: 16,
    viewBox: [0, 0, 16, 16],
    nodes: [
      {
        id: 'units',
        type: 'group',
        scaleX: 0.000001,
        children: [
          {
            id: 'undo',
            type: 'group',
            scaleX: 1000000,
            children: [
              {
                id: 'r',
                type: 'path',
                d: 'M2 2H14V14H2Z',
                fill: { color: 'currentColor' },
              },
            ],
          },
        ],
      },
    ],
  });
  expect(diagnostics).toEqual([]);

  const svg = toSVG(new Player(model!));
  expect([...svg.matchAll(/transform="([^"]+)"/g)].map((m) => m[1]).slice(0, 2)).toEqual([
    'matrix(0.000001 0 0 1 0 0)',
    'matrix(1000000 0 0 1 0 0)',
  ]);
});

it('keeps float noise at 0 and ordinary entries at five decimals', () => {
  const { model } = load({
    anima: '0.1',
    name: 'turn',
    grid: 20,
    nodes: [
      {
        id: 'g',
        type: 'group',
        rotate: 90,
        children: [{ id: 'r', type: 'rect', x0: 2, y0: 2, w: 4, h: 4, fill: { color: '#000' } }],
      },
      { id: 'h', type: 'group', rotate: 30, children: [] },
    ],
  });
  const svg = toSVG(new Player(model!));
  expect(svg).toContain('matrix(0 1 -1 0 0 0)');
  expect(svg).not.toMatch(/e-\d/);
});
