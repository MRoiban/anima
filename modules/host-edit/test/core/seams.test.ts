import { expect, it } from 'vitest';
import { player, document } from './fixture.ts';
import { listState } from '../../../lists/core/index.ts';
import { Player } from '../../../../packages/core/src/index.ts';
import { dataState } from '../../../data/core/index.ts';

it('shares one FIFO across whole-list/scalar writes, helpers, callbacks and wake batches', () => {
  const p = player(),
    a = p.data,
    list = a.list('items');
  const delivered: unknown[] = [];
  list.on('change', (v) => delivered.push(v));
  let wakes = 0;
  p.onChange = () => wakes++;
  a.batch(() => {
    list.set([{ count: 20 }]);
    list.add({ count: 21 });
    a.number('items.0.count').set(22);
    list.swap(0, 1);
  });
  expect(wakes).toBe(1);
  expect(list.value).toEqual([{ count: 5 }, { count: 7 }]);
  p.step(0);
  expect(list.value).toEqual([{ count: 21 }, { count: 22 }]);
  expect(delivered).toEqual([[{ count: 21 }, { count: 22 }]]);
  list.add({ count: 23 });
  list.set([{ count: 24 }]);
  list.add({ count: 25 });
  p.step(0);
  expect(list.value).toEqual([{ count: 24 }, { count: 25 }]);
  a.enqueue(() => a.number('score').set(7));
  expect(p.step(0).settled).toBe(false);
  expect(a.number('score').value).toBe(0);
  expect(p.busy).toBe(true);
  p.step(0);
  expect(a.number('score').value).toBe(7);
});

export function globalDocument() {
  const doc = document();
  return {
    ...doc,
    requires: ['data', 'components'],
    data: {
      ...doc.data,
      models: { ...doc.data.models, Board: { ...doc.data.models.Board, global: true } },
    },
    components: {
      badge: {
        grid: 20,
        nodes: [{ id: 'child', type: 'circle', center: [10, 10], r: 1 }],
        bind: { 'child.r': { value: '$score' } },
      },
    },
    nodes: [...doc.nodes, { id: 'badge', type: 'instance', component: 'badge' }],
  };
}
it('replaces global storage atomically for root, existing child APIs, scalar routing and subscriptions', () => {
  const p = player(globalDocument()),
    a = p.data;
  const child = (p.nested as unknown as { players: Map<string, Player> }).players.get('badge')!;
  const b = child.data;
  b.bind('main');
  const root = a.number('$main:score'),
    nested = b.number('score');
  const values: number[] = [];
  root.on('change', (v) => values.push(v));
  nested.on('change', (v) => values.push(v * 10));
  const globals = a.globals();
  expect(globals.map((i) => i.name)).toEqual(['main', 'other']);
  globals.pop();
  expect(a.globals()).toHaveLength(2);
  expect(a.models().find((m) => m.name === 'Board')?.global).toBe(true);
  a.setGlobal('main', a.instance('other'));
  root.set(9);
  expect(root.value).toBe(0);
  p.step(0);
  expect(root.value).toBe(9);
  expect(nested.value).toBe(9);
  expect(values).toEqual([90, 9]);
  expect(p.value('dot.r')).toBe(9);
  expect(p.values()['badge/child.r']).toBe(9);
  expect(dataState(p)!.instances.main).toBe(dataState(p)!.instances.other);
  nested.set(12);
  p.step(0);
  expect(root.value).toBe(12);
  // A new player of the compiled document retains authored storage.
  expect(new Player(p.model).get('$score')).toBe(0);
});
it.each([
  ['unknown', 'other', 'data-instance'],
  ['named', 'named', 'data-instance'],
  ['main', 'named', 'data-type'],
])('rejects global replacement %s/%s with a full diagnostic', (target, source, code) => {
  const a = player(globalDocument()).data;
  try {
    a.setGlobal(target, a.instance(source));
    expect.fail('expected error');
  } catch (e) {
    expect(e).toMatchObject({
      code,
      pointer: '/data/' + target,
      message: expect.stringMatching(/.+/),
      hint: expect.stringMatching(/.+/),
    });
  }
});
it('rejects foreign records without altering a global', () => {
  const a = player(globalDocument()).data,
    foreign = player(globalDocument()).data.instance('other');
  expect(() => a.setGlobal('main', foreign)).toThrowError(
    expect.objectContaining({ code: 'data-instance', pointer: '/data/main' }),
  );
  expect(a.number('score').value).toBe(0);
});
it('propagates global replacement into repeated players and parent contexts without rebuilding them', () => {
  const doc = globalDocument();
  const p = player({
    ...doc,
    requires: ['data', 'components', 'lists', 'bind'],
    components: {
      ...doc.components,
      row: {
        grid: 10,
        data: 'Item',
        nodes: [{ id: 'dot', type: 'circle', center: [2, 2], r: 1 }],
        bind: { 'dot.r': '$main:score', 'dot.x': '$parent.score' },
      },
    },
    nodes: [...doc.nodes, { id: 'rows', type: 'repeat', list: '$items', component: 'row' }],
  });
  p.step(0.25);
  const retained = listState(p)!.runs[0]!.items[1]!.player;
  const replacement = p.data.create('Board', { score: 13, items: [p.data.instance('named')] });
  p.data.setGlobal('main', replacement);
  p.step(0);
  expect(listState(p)!.runs[0]!.items[0]!.player).toBe(retained);
  expect(retained.time).toBe(0.25);
  expect(p.values()['rows/0/dot.r']).toBe(13);
  expect(p.values()['rows/0/dot.x']).toBe(13);
  expect(p.values()['rows/1/dot.r']).toBeUndefined();
  p.data.list('items').add({ count: 6 });
  p.step(0);
  expect(p.values()['rows/1/dot.r']).toBe(13);
  expect(p.values()['rows/1/dot.x']).toBe(13);
});

it('rejects malformed enqueue callbacks with the host diagnostic contract', () => {
  expect(() => player().data.enqueue(null as never)).toThrowError(
    expect.objectContaining({
      code: 'data-type',
      pointer: '/data/',
      message: expect.stringMatching(/.+/),
      hint: expect.stringMatching(/.+/),
    }),
  );
});
it('projects global replacement and shared aliases in FIFO order before list helpers', () => {
  const p = player(globalDocument()),
    a = p.data;
  a.setGlobal('main', a.instance('other'));
  a.list('$main:items').add({ count: 11 });
  a.list('$other:items').add({ count: 12 });
  p.step(0);
  expect(a.list('items').value).toEqual([{ count: 11 }, { count: 12 }]);
  a.list('$main:items').add({ count: 13 });
  a.setGlobal('main', a.instance('main'));
  a.list('$other:items').add({ count: 14 });
  p.step(0);
  expect(a.list('items').value).toEqual([
    { count: 11 },
    { count: 12 },
    { count: 13 },
    { count: 14 },
  ]);
});
