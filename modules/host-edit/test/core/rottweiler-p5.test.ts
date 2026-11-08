import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';

// Rottweiler P5 R3-04: list editors take owned instance handles; other maps are property values.
it('accepts property maps with name/model keys and rejects foreign or forged records', () => {
  const plain = load({
    anima: '0.1',
    name: 'list-map',
    grid: 24,
    requires: ['data'],
    nodes: [{ id: 'g', type: 'group', children: [] }],
    data: {
      models: {
        Root: { properties: { items: { type: 'list', of: 'Item' } } },
        Item: { properties: { name: { type: 'string' }, model: { type: 'string' } } },
      },
      model: 'Root',
    },
  }).model!;
  const p = new Player(plain);
  p.data.bind(p.data.defaultInstance());
  p.data.list('items').add({ name: 'new-name', model: 'model-label' });
  p.step(0);
  expect(p.data.list('items').value).toEqual([{ name: 'new-name', model: 'model-label' }]);

  const owned = load({
    anima: '0.1',
    name: 'host-list',
    grid: 24,
    requires: ['data'],
    nodes: [{ id: 'g', type: 'group', children: [] }],
    data: {
      models: {
        Root: { properties: { items: { type: 'list', of: 'Item' } } },
        Item: { properties: { n: { type: 'number' } } },
      },
      instances: {
        main: { model: 'Root', default: true },
        named: { model: 'Item', values: { n: 1 } },
      },
    },
  }).model!;
  const a = new Player(owned),
    b = new Player(owned);
  a.data.bind('main');
  b.data.bind('main');
  const list = a.data.list('items');
  expect(() => list.add(b.data.instance('named'))).toThrow();
  expect(() => list.add({ name: 'named', model: 'Item' })).toThrow();
  list.add(a.data.instance('named'));
  a.step(0);
  expect(list.value).toEqual([{ n: 1 }]);
  expect(() => list.remove(b.data.instance('named'))).toThrow(
    expect.objectContaining({ code: 'data-instance' }),
  );
  list.remove(a.data.instance('named'));
  a.step(0);
  expect(list.value).toEqual([]);
});
