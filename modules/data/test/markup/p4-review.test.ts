// Regression tests for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { compile, decompile } from '@anima-format/markup';

it('R2-08: AniML guard rewriting leaves quoted string literals untouched', () => {
  const when = '$label == "A&&B" && $label != "x and y<=z"';
  const doc = {
    anima: '0.1',
    name: 'p4',
    grid: 20,
    requires: ['machine', 'data'],
    nodes: [{ id: 'd', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
    data: { models: { M: { properties: { label: { type: 'string', default: 'A&&B' } } } } },
    machine: {
      layers: {
        l: {
          initial: 'a',
          states: { a: { pose: { 'd.x': 0 }, on: [{ when, to: 'b' }] }, b: { pose: { 'd.x': 5 } } },
        },
      },
    },
  };
  const c = compile(decompile(doc));
  expect(c.diagnostics).toEqual([]);
  expect((c.doc as typeof doc).machine.layers.l.states.a.on[0]!.when).toBe(when);
});
