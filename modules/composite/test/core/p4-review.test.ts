// Regression tests for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

const player = (paints: object[]) => {
  const r = load({
    anima: '0.1',
    name: 'p4',
    grid: 20,
    requires: ['composite'],
    nodes: [{ id: 'c', type: 'circle', center: [10, 10], r: 4, paints }],
    inputs: { a: { type: 'trigger' } },
    listeners: [{ on: 'click', target: 'c', fire: 'a' }],
  });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
};

it('R1-06: ordered fill and stroke paints are hit geometry', () => {
  const filled = player([{ fill: { color: '#000' } }]);
  const listener = filled.model.listeners[0]!;
  expect(filled.hits(listener, 10, 10)).toBe(true);
  expect(filled.hits(listener, 10, 15.5)).toBe(false);
  const stroked = player([{ stroke: { color: '#000', width: 2 } }]);
  expect(stroked.hits(listener, 10, 14.8)).toBe(true);
  expect(stroked.hits(listener, 10, 10)).toBe(false);
});

it('R2-01: hidden paints are not hit geometry', () => {
  const hidden = (requires: string[], paints: object[]) => {
    const r = load({
      anima: '0.1',
      name: 'p4',
      grid: 20,
      requires,
      nodes: [{ id: 'c', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, ...paints[0] }],
      inputs: { a: { type: 'trigger' } },
      listeners: [{ on: 'click', target: 'c', fire: 'a' }],
    });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const p = new Player(r.model!);
    return [p.hits(p.model.listeners[0]!, 5, 5), p.hits(p.model.listeners[0]!, -1.5, 5)];
  };
  const both = [
    { fill: { color: '#000', visible: false } },
    { stroke: { color: '#000', width: 4, visible: false } },
  ];
  expect(hidden(['composite'], [{ paints: both }])).toEqual([false, false]);
  expect(hidden(['composite'], [{ ...both[0], ...both[1] }])).toEqual([false, false]);
  const clockwise = [{ fill: { color: '#000', winding: 'clockwise', visible: false } }, both[1]];
  expect(hidden(['composite', 'contour'], [{ paints: clockwise }])).toEqual([false, false]);
  expect(hidden(['composite'], [{ paints: [{ fill: { color: '#000' } }] }])).toEqual([true, false]);
});
