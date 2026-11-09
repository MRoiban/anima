import '../../../../packages/core/src/all.ts';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { component } from '../../core/index.ts';
const requires = ['components', 'nested', 'data', 'host', 'dataartboard', 'bind'];
const leaf = {
  grid: 20,
  nodes: [{ id: 'dot', type: 'circle', center: [5, 5], r: 1, fill: { color: '#f00' } }],
  bind: { 'dot.r': '$radius' },
};
function make(extra: Record<string, unknown> = {}) {
  const r = load({
    anima: '0.1',
    name: 'catalog',
    grid: 20,
    requires,
    data: {
      models: {
        Card: {
          properties: {
            content: { type: 'artboard', default: '' },
            radius: { type: 'number', default: 2 },
          },
        },
      },
      instances: { main: { model: 'Card', default: true, values: { radius: 3 } } },
    },
    nodes: [{ id: 'slot', type: 'instance', component: '$content' }],
    ...extra,
  } as never);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.data.bind('main');
  p.step(0);
  return p;
}
it('R3-1: a definition placed only inside another component is an assignable catalog value', () => {
  const source = make({
    nodes: [{ id: 'outer', type: 'instance', component: 'wrapper' }],
    components: {
      wrapper: { grid: 20, nodes: [{ id: 'inner', type: 'instance', component: 'leaf' }] },
      leaf,
    },
  });
  const target = make();
  target.data.artboard('content').set(component(source.model, 'leaf'));
  target.step(0);
  expect(target.values()['slot/dot.r']).toBe(3);
});
