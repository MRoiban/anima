// Regression tests for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, registerSVGBackend, svgBackends, toSVG } from '@anima-format/core';

it('R2-06: SVG backends run in module dependency order, not registration order', () => {
  const r = load({
    anima: '0.1',
    name: 'p4',
    grid: 20,
    requires: ['contour', 'mix'],
    nodes: [
      {
        id: 'r',
        type: 'rect',
        x0: 0,
        y0: 0,
        w: 10,
        h: 10,
        stroke: {
          color: '#000',
          width: 1,
          blend: 'multiply',
          effects: [{ type: 'trim', start: 0, end: 0.5 }],
        },
      },
    ],
  });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const svg = () => toSVG(new Player(r.model!));
  const expected = svg();
  // Simulate a web page that loads the contour bundle after mix.
  const contour = svgBackends.get('contour')!;
  svgBackends.delete('contour');
  registerSVGBackend('contour', contour);
  expect(svg()).toBe(expected);
  expect(expected).toContain('d="M0 0L10 0L10 10"');
});
