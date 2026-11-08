// Regression tests for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

it('R3-06: an always-random calculate converter keeps the player unsettled', () => {
  const settled = (converter: object) => {
    const r = load({
      anima: '0.1',
      name: 'p4',
      grid: 20,
      requires: ['data', 'bind', 'convert'],
      nodes: [{ id: 'r', type: 'rect', x0: 0, y0: 0, w: 4, h: 4, fill: { color: '#000' } }],
      bind: { 'r.x': { value: '$v', convert: 'rng' } },
      converters: { rng: converter },
      data: { models: { M: { properties: { v: { type: 'number', default: 1 } } } } },
    });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const p = new Player(r.model!, { seed: 7 });
    p.step(0);
    return [p.step(0.1).settled, p.busy];
  };
  expect(settled({ type: 'formula', expression: 'random()', random: 'always' })).toEqual([
    false,
    true,
  ]);
  expect(settled({ type: 'calculate', operation: 'random', random: 'always' })).toEqual([
    false,
    true,
  ]);
});
