import { expect, it } from 'vitest';
import { load, Player, registerModule } from '../../../../packages/core/src/index.ts';
import { data } from '../../../data/core/index.ts';
import { host } from '../../core/index.ts';
it('host alone loads its value-construction companion without a new core registration requirement', () => {
  registerModule(data);
  registerModule(host);
  const result = load({
    anima: '0.1',
    name: 'standalone',
    grid: 20,
    requires: ['data'],
    data: { models: { Score: { properties: { n: { type: 'number' } } } } },
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
  });
  expect(result.diagnostics).toEqual([]);
  const p = new Player(result.model!);
  p.data.bind('default');
  p.data.number('n').set(7);
  p.step(0);
  expect(p.data.number('n').value).toBe(7);
  expect(p.data.create('Score', { n: 8 }).model).toBe('Score');
});
