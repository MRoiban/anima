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
