// Regression tests for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, toSVG } from '@anima-format/core';

it('R3-08: surface feathering keeps contour per-paint paths', () => {
  const r = load({
    anima: '0.1',
    name: 'p4',
    grid: 20,
    requires: ['contour', 'surface'],
    nodes: [
      {
        id: 'r',
        type: 'rect',
        x0: 2,
        y0: 2,
        w: 10,
        h: 10,
        fill: { color: '#f00', winding: 'clockwise', feather: { outer: 1 } },
      },
    ],
  });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const svg = toSVG(new Player(r.model!));
  expect(svg).toMatch(/filter="url\(#[\w-]+feather-fill\)"><path [^>]*fill="#f00"[^>]* d="M2 2/);
});
