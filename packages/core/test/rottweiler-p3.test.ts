import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '../src/index.ts';

// Rottweiler P3 R1-04: an unrelated, explicitly seeded root stepped re-entrantly (from another
// seeded player's data subscription) keeps its own random source.
it('keeps an explicitly seeded root on its own random source when stepped re-entrantly', () => {
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'rng',
    grid: 20,
    requires: ['data', 'bind', 'convert'],
    data: { models: { State: { properties: { value: { type: 'number' } } } } },
    converters: { rng: { type: 'formula', expression: 'random()', random: 'always' } },
    bind: { 'dot.x': { value: '$value', convert: 'rng' } },
    nodes: [{ id: 'dot', type: 'circle', center: [2, 2], r: 1, fill: { color: '#000' } }],
  });
  expect(diagnostics).toEqual([]);
  const a = new Player(model!, { seed: 1 });
  const b = new Player(model!, { seed: 1000 });
  const control = new Player(model!, { seed: 1000 });
  a.data.bind(a.data.defaultInstance());
  a.data.number('$value').on('change', () => b.step(0));
  a.data.number('$value').set(1);
  a.step(0);
  control.step(0);
  expect(b.value('dot.x')).toBe(control.value('dot.x'));
  b.step(0);
  control.step(0);
  expect(b.value('dot.x')).toBe(control.value('dot.x'));
});
