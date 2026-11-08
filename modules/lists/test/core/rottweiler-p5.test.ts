import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, drawFrame, drawOrder, toSVG } from '../../../../packages/core/src/index.ts';
import { listState } from '../../core/index.ts';

function player(doc: object) {
  const { model, diagnostics } = load(doc);
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(model!);
}
const base = (n: number) => ({
  anima: '0.1',
  name: 'p5-rottweiler',
  grid: 24,
  requires: ['data', 'bind', 'components', 'lists'],
  data: {
    models: {
      Root: {
        properties: { n: { type: 'number', default: n }, x: { type: 'number', default: 1 } },
      },
    },
    model: 'Root',
  },
});

// R1-01: recycled slots must keep the child's authored sibling order.
it('keeps authored child paint order when repeat slots are recycled', () => {
  const p = player({
    ...base(2),
    components: {
      row: {
        grid: 24,
        nodes: [
          { id: 'a', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#ff0000' } },
          { id: 'b', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#0000ff' } },
        ],
      },
    },
    nodes: [{ id: 'rows', type: 'repeat', count: '$n', component: 'row' }],
  });
  p.step(0);
  p.set('$n', 0);
  p.step(0);
  p.set('$n', 1);
  p.step(0);
  const f = drawFrame(p);
  const group = f.tree.nodes[0]!.children[0]!;
  expect(drawOrder(f, f.tree.nodes[group]!.children).map((i) => f.tree.nodes[i]!.id)).toEqual([
    'rows/0/a',
    'rows/0/b',
  ]);
  expect([...toSVG(p).matchAll(/fill="(#[\da-f]+)"/g)].map((m) => m[1])).toEqual([
    '#ff0000',
    '#0000ff',
  ]);
});

// R1-02: a shared-data write by a repeated child keeps the parent unsettled (SPEC inherited data context).
it('stays unsettled after a repeated child writes inherited shared data', () => {
  const p = player({
    ...base(1),
    components: {
      row: {
        grid: 24,
        nodes: [{ id: 'a', type: 'rect', x0: 0, y0: 0, w: 1, h: 1, fill: { color: '#000' } }],
      },
    },
    nodes: [
      { id: 'rows', type: 'repeat', count: '$n', component: 'row' },
      { id: 'dot', type: 'circle', center: [12, 12], r: 1, fill: { color: '#000' } },
    ],
    bind: { 'dot.r': '$x' },
  });
  p.step(0);
  listState(p)!.runs[0]!.items[0]!.player.set('$x', 5);
  expect(p.step(0).settled).toBe(false);
  expect(p.get('$x')).toBe(5);
  expect(p.step(0).settled).toBe(true);
  expect(p.value('dot.r')).toBe(5);
});

// R2-01: a child's initial expansion uses model defaults before its item context binds, so
// construction is not counted against the live-instance budget (R1-05 deferred, see ledger).
it('constructs a row whose bound count is small although its model default is large', () => {
  const p = player({
    ...base(0),
    data: {
      models: {
        Root: { properties: { rows: { type: 'list', of: 'Row' } } },
        Row: { properties: { n: { type: 'number', default: 256 } } },
      },
      model: 'Root',
      instances: { main: { model: 'Root', values: { rows: [{ n: 0 }] } } },
    },
    components: {
      row: {
        grid: 24,
        data: 'Row',
        nodes: [{ id: 'inner', type: 'repeat', count: '$n', component: 'leaf' }],
      },
      leaf: {
        grid: 24,
        nodes: [{ id: 'dot', type: 'circle', center: [1, 1], r: 1, fill: { color: '#000' } }],
      },
    },
    nodes: [{ id: 'outer', type: 'repeat', list: '$rows', component: 'row' }],
  });
  expect(p.step(0).settled).toBe(true);
  expect(listState(listState(p)!.runs[0]!.items[0]!.player)!.runs[0]!.items).toHaveLength(0);
});

// R2-02: an independent root built re-entrantly during another tree's step has its own budget.
it('keeps independent roots built during a step out of the stepping tree budget', () => {
  const doc = (n: number) => ({
    ...base(n),
    components: {
      row: {
        grid: 24,
        nodes: [{ id: 'dot', type: 'circle', center: [1, 1], r: 1, fill: { color: '#000' } }],
      },
    },
    nodes: [{ id: 'rows', type: 'repeat', count: '$n', component: 'row' }],
  });
  const independent = load(doc(100)).model!;
  const p = player(doc(200));
  p.step(0);
  const child = listState(p)!.runs[0]!.items.at(-1)!.player;
  const original = child.step.bind(child);
  child.step = (dt) => {
    new Player(independent);
    return original(dt);
  };
  expect(() => p.step(0)).not.toThrow();
  // The step budget itself still applies to nested repeats.
  const nested = player({
    ...base(20),
    components: {
      row: { grid: 24, nodes: [{ id: 'inner', type: 'repeat', count: '$n', component: 'leaf' }] },
      leaf: {
        grid: 24,
        nodes: [{ id: 'dot', type: 'circle', center: [1, 1], r: 1, fill: { color: '#000' } }],
      },
    },
    nodes: [{ id: 'outer', type: 'repeat', count: '$n', component: 'row' }],
  });
  expect(() => nested.step(0)).toThrow(expect.objectContaining({ code: 'limit-exceeded' }));
});
