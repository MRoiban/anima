import '../../../../packages/core/src/all.ts';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
it('R4-3: requiring dataartboard keeps nested $parent compilation context', () => {
  const doc = {
    anima: '0.1',
    name: 'parent-context',
    grid: 20,
    data: {
      models: {
        Root: { properties: { content: { type: 'component', default: '' } } },
        Wrap: { properties: { radius: { type: 'number', default: 7 } } },
        Leaf: { properties: { n: { type: 'number', default: 2 } } },
      },
    },
    components: {
      wrapper: {
        grid: 20,
        data: 'Wrap',
        nodes: [{ id: 'inner', type: 'instance', component: 'leaf' }],
      },
      leaf: {
        grid: 20,
        data: 'Leaf',
        nodes: [{ id: 'dot', type: 'circle', center: [5, 5], r: 1, fill: { color: '#f00' } }],
        bind: { 'dot.r': '$parent.radius' },
      },
    },
    nodes: [{ id: 'outer', type: 'instance', component: 'wrapper' }],
  };
  for (const extra of [[], ['dataartboard']]) {
    const requires = ['components', 'nested', 'data', 'host', 'bind', 'lists', ...extra];
    const r = load({ ...doc, requires });
    expect(r.diagnostics).toEqual([]);
    const p = new Player(r.model!);
    p.step(0);
    expect(p.values()['outer/inner/dot.r']).toBe(7);
  }
  // The raw document is unchanged after loading.
  expect(doc.data.models.Root.properties.content.type).toBe('component');
  // A document without data gains no data key.
  const bare = {
    anima: '0.1',
    name: 'bare',
    grid: 20,
    requires: ['data', 'dataartboard'],
    nodes: [],
  };
  load(bare);
  expect('data' in bare).toBe(false);
});
