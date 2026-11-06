import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { DataError } from '../../core/index.ts';
import { player } from './fixture.ts';
function error(fn: () => unknown, code: string) {
  try {
    fn();
    throw Error('did not throw');
  } catch (e) {
    expect(e).toBeInstanceOf(DataError);
    const d = e as DataError;
    expect(d.code).toBe(code);
    expect(d.pointer).toMatch(/^\/data\//);
    expect(d.message.length).toBeGreaterThan(0);
    expect(d.hint.length).toBeGreaterThan(0);
  }
}
it('reports every host error with data codes, pointers, messages and hints', () => {
  const p = player(),
    a = p.data;
  error(() => a.get('$score'), 'data-instance');
  error(() => a.get('$missing:score'), 'data-instance');
  error(() => a.bind('missing'), 'data-instance');
  error(() => a.bind(null as never), 'data-instance');
  error(() => a.get(null as never), 'data-type');
  error(() => a.create('Score', 3 as never), 'data-type');
  error(() => a.batch(null as never), 'data-type');
  error(() => a.create('Missing'), 'data-model');
  error(() => a.bind({ name: 'main', model: 'Item' }), 'data-instance');
  const item = a.create('Item');
  error(() => a.bind(item), 'data-type');
  a.bind('main');
  for (const path of [
    '$missing',
    '$score.x',
    '$items.99.count',
    'score',
    '$items.-1.count',
    '$__proto__',
  ])
    error(() => a.get(path), 'data-path');
  error(() => a.string('$score'), 'data-type');
  error(() => a.list('$items.0'), 'data-type');
  error(() => a.number('$items.length').set(0), 'data-readonly');
  error(() => a.number('$score').set('bad' as never), 'data-type');
  error(() => a.number('$score').set(NaN), 'data-type');
  error(() => a.enum('$mood').set('missing'), 'data-type');
  error(() => a.boolean('$active').set(1 as never), 'data-type');
  error(() => a.color('$tint').set('bad'), 'data-type');
  error(() => a.trigger('$pulse').set(undefined), 'data-type');
  error(() => a.image('$image').set('font'), 'data-asset');
  error(() => a.font('$font').set('missing'), 'data-asset');
  error(() => a.font('$font').set(true as never), 'data-type');
  error(() => a.create('Score', { score: 'bad' }), 'data-type');
  error(() => a.create('Score', { missing: 4 }), 'data-path');
  error(() => a.number('$score').on('other' as never, () => {}), 'data-type');
  error(() => a.number('$score').on('change', null as never), 'data-type');
});
it('reports the absent-data case as a typed unknown-model error', () => {
  const r = load({
    anima: '0.1',
    name: 'empty',
    grid: 20,
    nodes: [{ id: 'empty', type: 'group', children: [] }],
  });
  error(() => new Player(r.model!).data, 'data-model');
});
it('rejects list writes that would introduce a cycle through an existing named instance', () => {
  const p = player({
    anima: '0.1',
    name: 'acyclic',
    grid: 20,
    requires: ['data'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    data: {
      models: { Tree: { properties: { children: { type: 'list', of: 'Tree' } } } },
      instances: { main: { model: 'Tree', default: true } },
    },
  });
  p.data.bind('main');
  error(() => p.data.list('$children').set(['main']), 'data-cycle');
  expect(p.data.get('$children')).toEqual([]);
  p.step(0);
});
