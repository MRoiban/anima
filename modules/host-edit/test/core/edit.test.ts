import { player } from './fixture.ts';
import { expect, it } from 'vitest';
import type { Player } from '../../../../packages/core/src/index.ts';
import { dataState } from '../../../data/core/index.ts';
import { DataError } from '../../../host/core/errors.ts';
it('discovers default/named instances, color channels/hex and enum members/index', () => {
  const p = player(),
    a = p.data;
  expect(a.defaultInstance()).toEqual({ name: 'main', model: 'Board' });
  a.bind(a.instance('other'));
  expect(a.number('score').value).toBe(8);
  a.bind(a.defaultInstance());
  const c = a.color('tint');
  expect(c.rgba).toEqual([18, 52, 86, 120]);
  c.rgba[0] = 0;
  expect(c.hex).toBe('#12345678');
  const e = a.enum('mood');
  e.values.pop();
  expect(e.values).toEqual(['calm', 'happy']);
  a.batch(() => {
    c.set([255, 128, 0, 255]);
    e.index = 1;
  });
  expect(e.index).toBe(0);
  p.step(0);
  expect(e.index).toBe(1);
  expect(c.hex).toBe('#ff8000');
});
it('composes queued add/insert/swap/remove and preserves list/inline/named identities', () => {
  const p = player(),
    a = p.data,
    list = a.list('items');
  const storage = dataState(p)!.instances.main!.items as object[];
  const [first, named] = storage;
  const item = list.at(0);
  let wakes = 0;
  p.onChange = () => wakes++;
  const changes: unknown[] = [];
  list.on('change', (v) => changes.push(v));
  a.batch(() => {
    list.add({ count: 11 });
    list.add();
    list.insert(0, { count: 2 });
    list.swap(1, 2);
    list.remove(3);
  });
  expect(wakes).toBe(1);
  expect(list.length).toBe(2);
  expect(p.busy).toBe(true);
  p.step(0);
  expect(list.value).toEqual([{ count: 2 }, { count: 7 }, { count: 5 }, { count: 3 }]);
  expect(dataState(p)!.instances.main!.items).toBe(storage);
  expect(storage[1]).toBe(named);
  expect(storage[2]).toBe(first);
  expect(storage[1]).toBe(dataState(p)!.instances.named);
  expect(changes).toHaveLength(1);
  item.number('count').set(17);
  p.step(0);
  expect(storage[2]).toEqual({ count: 17 });
  list.remove(item);
  p.step(0);
  expect(() => item.get('count')).toThrow('removed');
  expect(storage).not.toContain(first);
});
it('nested batches, callback edits, net zero operations, and thrown batches retain writes', () => {
  const p = player(),
    a = p.data,
    list = a.list('items');
  const values: number[] = [];
  list.on('change', (v) => {
    values.push(v.length);
    if (v.length === 3) {
      expect(() => p.step(0)).toThrow('subscription');
      list.add();
    }
  });
  expect(() =>
    a.batch(() => {
      a.batch(() => list.add());
      throw Error('retain');
    }),
  ).toThrow('retain');
  expect(p.step(0).settled).toBe(false);
  expect(values).toEqual([3]);
  p.step(0);
  expect(values).toEqual([3, 4]);
  list.swap(0, 1);
  list.swap(0, 1);
  p.step(0);
  expect(values).toEqual([3, 4]);
  a.batch(() => expect(() => p.step(0)).toThrow('batch'));
});
it('retains host alone semantics for replacement, rebinding, and typed validation', () => {
  const p = player(),
    a = p.data;
  const handle = a.list('items');
  a.bind('other');
  handle.add({ count: 12 });
  p.step(0);
  expect(a.list('items').value).toEqual([{ count: 12 }]);
  a.bind('main');
  handle.add({ count: 9 });
  handle.set([{ count: 15 }]);
  p.step(0);
  expect(handle.value).toEqual([{ count: 15 }]);
});
it('supports mixed lists, named sharing and nested list paths', () => {
  const p = player(),
    a = p.data;
  a.list('mixed').add(a.instance('named'));
  a.list('items').add(a.create('Item', { count: 19 }));
  p.step(0);
  expect(a.list('mixed').at(0).number('count').value).toBe(7);
  expect((dataState(p)!.instances.main!.mixed as object[])[0]).toBe(dataState(p)!.instances.named);
});
it.each([
  ['data-path', '$items', (p: Player) => p.data.list('$items').at(-1)],
  ['data-path', '$items', (p: Player) => p.data.list('$items').insert(99)],
  ['data-path', '$items', (p: Player) => p.data.list('$items').remove(2)],
  ['data-path', '$items', (p: Player) => p.data.list('$items').swap(0, 3)],
  [
    'data-enum',
    '$mood',
    (p: Player) => {
      p.data.enum('$mood').index = 0.5;
    },
  ],
  ['data-instance', 'missing', (p: Player) => p.data.instance('missing')],
  ['data-model', '$mixed', (p: Player) => p.data.list('$mixed').add()],
  ['data-type', '$items', (p: Player) => p.data.list('$items').add(p.data.defaultInstance())],
])('diagnoses %s with exact pointer, message and hint (%s)', (code, path, action) => {
  try {
    action(player());
    expect.fail('expected diagnostic');
  } catch (error) {
    expect(error).toBeInstanceOf(DataError);
    expect(error).toMatchObject({ code, pointer: '/data/' + path, severity: 'error' });
    expect((error as DataError).message.length).toBeGreaterThan(0);
    expect((error as DataError).hint.length).toBeGreaterThan(0);
  }
});
it('rejects cycles across multiple projected lists before any write applies', () => {
  const p = player({
    anima: '0.1',
    name: 'cycles',
    grid: 20,
    requires: ['data'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    data: {
      models: { Node: { properties: { children: { type: 'list', of: 'Node' } } } },
      instances: { main: { model: 'Node', default: true }, other: { model: 'Node' } },
    },
  });
  const a = p.data;
  a.list('$main:children').add(a.instance('other'));
  expect(() => a.list('$other:children').add(a.instance('main'))).toThrowError(
    expect.objectContaining({ code: 'data-cycle', pointer: '/data/$other:children' }),
  );
  p.step(0);
  expect(a.list('$main:children').length).toBe(1);
  expect(a.list('$other:children').length).toBe(0);
});
it('empty/nested batches do not re-wake edits already queued outside them', () => {
  const p = player();
  let wakes = 0;
  p.onChange = () => wakes++;
  p.data.list('items').add();
  expect(wakes).toBe(1);
  p.data.batch(() => p.data.batch(() => {}));
  expect(wakes).toBe(1);
});
it('reports malformed list values/removal and instance names as typed errors', () => {
  const a = player().data;
  expect(() => a.list('items').insert(0, null as never)).toThrowError(
    expect.objectContaining({ code: 'data-type', pointer: '/data/items' }),
  );
  expect(() => a.list('items').remove(null as never)).toThrowError(
    expect.objectContaining({ code: 'data-type', pointer: '/data/items' }),
  );
  expect(() => a.instance(null as never)).toThrowError(
    expect.objectContaining({ code: 'data-instance', pointer: '/data/null' }),
  );
});
it('core image helper diagnoses malformed values and an unavailable decoder', () => {
  const p = player({
    anima: '0.1',
    name: 'image',
    grid: 20,
    requires: ['data', 'assets'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    assets: { photo: { type: 'image', source: 'data:image/png;base64,iVBORw0KGgo=' } },
    data: {
      models: {
        Board: {
          properties: { picture: { type: 'asset-ref', assetType: 'image', default: 'photo' } },
        },
      },
      instances: { main: { model: 'Board', default: true } },
    },
  });
  for (const [value, code] of [
    [4, 'data-type'],
    ['https://example.test/image.png', 'data-asset'],
  ] as const) {
    try {
      p.data.image('picture').set(value as never);
      expect.fail('expected diagnostic');
    } catch (error) {
      expect(error).toBeInstanceOf(DataError);
      expect(error).toMatchObject({ code, pointer: '/data/picture', severity: 'error' });
      expect((error as DataError).message.length).toBeGreaterThan(0);
      expect((error as DataError).hint.length).toBeGreaterThan(0);
    }
  }
});
it('publishes initial, created, and replacement item model types for mixed repeat consumers', () => {
  const p = player(),
    a = p.data,
    state = dataState(p)!;
  const initial = (state.instances.main!.items as object[])[0]!;
  expect(state.modelTypes!.get(initial)).toBe('Item');
  a.list('mixed').add(a.create('Item', { count: 11 }));
  p.step(0);
  const created = (state.instances.main!.mixed as object[])[0]!;
  expect(state.modelTypes!.get(created)).toBe('Item');
  a.list('mixed').set([{ model: 'Item', values: { count: 12 } }]);
  p.step(0);
  const replaced = (state.instances.main!.mixed as object[])[0]!;
  expect(state.modelTypes!.get(replaced)).toBe('Item');
  expect(replaced).not.toBe(created);
});
it('rejects invalid steps without applying or discarding queued list edits', () => {
  const p = player(),
    list = p.data.list('items');
  list.add();
  for (const dt of [-1, NaN, undefined]) {
    expect(() => p.step(dt as number)).toThrow();
    expect(list.length).toBe(2);
  }
  p.step(0);
  expect(list.length).toBe(3);
});
