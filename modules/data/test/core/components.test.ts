import '@anima-format/core/all';
import { it, expect } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
const raw = (global = false) => ({
  anima: '0.1',
  name: 'component-data',
  grid: 20,
  requires: ['data', 'bind', 'components'],
  data: {
    models: { Score: { global, properties: { score: { type: 'number', default: 3 } } } },
    instances: {
      main: { model: 'Score', default: true },
      other: { model: 'Score', values: { score: 8 } },
    },
  },
  components: {
    badge: {
      grid: 20,
      data: 'Score',
      nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
      bind: { 'dot.x': '$score' },
    },
  },
  nodes: [
    { id: 'a', type: 'instance', component: 'badge', data: 'main' },
    { id: 'b', type: 'instance', component: 'badge', data: 'other' },
  ],
});
it('binds a component public model separately for every placement', () => {
  const r = load(raw());
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  expect(p.value('a/dot.x')).toBe(3);
  expect(p.value('b/dot.x')).toBe(8);
  p.set('$score', 5);
  p.step(0);
  expect(p.value('a/dot.x')).toBe(5);
  expect(p.value('b/dot.x')).toBe(8);
});
it('preserves named nested instance identity across aliases', () => {
  const r = load({
    anima: '0.1',
    name: 'refs',
    grid: 20,
    requires: ['data'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    data: {
      models: {
        Root: { properties: { team: { type: 'model-ref', model: 'Team' } } },
        Team: { properties: { n: { type: 'number' } } },
      },
      instances: {
        root: { model: 'Root', default: true, values: { team: 'team' } },
        team: { model: 'Team' },
      },
    },
  });
  expect(r.model).toBeDefined();
  const p = new Player(r.model!);
  p.set('$team.n', 7);
  p.step(0);
  expect(p.get('$team:n')).toBe(7);
});
