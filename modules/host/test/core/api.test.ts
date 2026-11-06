import { describe, expect, it, vi } from 'vitest';
import { Player } from '../../../../packages/core/src/index.ts';
import { DataError } from '../../core/index.ts';
import { document, player } from './fixture.ts';
describe('host data API', () => {
  it('starts unbound, reads explicit paths and binds without changing named storage', () => {
    const p = player(),
      api = p.data;
    expect(p.data).toBe(api);
    expect(() => api.get('$score')).toThrow(DataError);
    expect(api.get('$main:score')).toBe(4);
    api.bind('main');
    const retained = api.number('$score');
    expect(retained.value).toBe(4);
    api.bind('other');
    p.step(0);
    expect(retained.value).toBe(7);
    expect(p.value('dot.r')).toBe(7);
    expect(api.get('$main:score')).toBe(4);
    expect(p.get('$score')).toBe(7);
    expect(new Player(p.model).get('$score')).toBe(4);
  });
  it('reads and queues all scalar handle types using data normalization', () => {
    const p = player(),
      a = p.data;
    a.bind('main');
    const calls: unknown[] = [];
    a.number('$score').on('change', (v) => calls.push(v));
    a.number('$score').set(99);
    a.string('$label').set('Grace');
    a.boolean('$active').set(true);
    a.color('$tint').set('#ff000080');
    a.enum('$mood').set('happy');
    a.image('$image').set('image');
    a.font('$font').set('font');
    expect(a.number('$score').value).toBe(4);
    expect(calls).toEqual([]);
    p.step(0);
    expect(a.number('$score').value).toBe(20);
    expect(a.string('$label').value).toBe('Grace');
    expect(a.boolean('$active').value).toBe(true);
    expect(a.color('$tint').value).toEqual([255, 0, 0, 128]);
    expect(a.enum('$mood').value).toBe('happy');
    expect(a.image('$image').value).toBe('image');
    expect(a.font('$font').value).toBe('font');
    expect(p.value('dot.r')).toBe(20);
    expect(calls).toEqual([20]);
  });
  it('keeps color reads and queued writes detached from caller mutation', () => {
    const p = player(),
      a = p.data;
    a.bind('main');
    const color: [number, number, number, number] = [1, 2, 3, 4];
    a.color('$tint').set(color);
    color[0] = 255;
    p.step(0);
    const read = a.color('$tint').value as number[];
    read[0] = 99;
    expect(a.get('$tint')).toEqual([1, 2, 3, 4]);
  });
  it('discovers models, resolved enums and instances without leaking metadata', () => {
    const p = player(),
      a = p.data;
    const models = a.models();
    expect(models.map((m) => m.name)).toEqual(['Score', 'Item']);
    const mood = models[0]!.properties.find((p) => p.name === 'mood')!;
    expect(mood).toEqual({ name: 'mood', type: 'enum', values: ['calm', 'happy'] });
    mood.values!.push('bad');
    expect(a.models()[0]!.properties.find((p) => p.name === 'mood')!.values).toEqual([
      'calm',
      'happy',
    ]);
    expect(a.instances()).toEqual([
      { name: 'main', model: 'Score' },
      { name: 'other', model: 'Score' },
    ]);
    const instances = a.instances();
    (instances[0] as { name: string }).name = 'broken';
    expect(a.instances()[0]!.name).toBe('main');
  });
  it('creates isolated instances, sets dynamic fields and binds the created instance to the scene', () => {
    const p = player(),
      a = p.data;
    const created = a.create('Score', { score: 9, label: 'New' });
    a.bind(created);
    expect(a.number('$score').value).toBe(9);
    p.step(0);
    expect(p.value('dot.r')).toBe(9);
    a.number('$score').set(40);
    p.step(0);
    expect(a.number('$score').value).toBe(20);
    expect(p.value('dot.r')).toBe(20);
    expect(a.get('$main:score')).toBe(4);
    expect(a.string('$label').value).toBe('New');
    expect(a.instances()).toContainEqual(created);
    const q = new Player(p.model);
    expect(q.data.instances()).toHaveLength(2);
  });
  it('reads nested/list paths, replaces lists and validates their items', () => {
    const p = player(),
      a = p.data;
    a.bind('main');
    expect(a.get('$items')).toEqual([{ count: 5 }]);
    expect(a.number('$items.0.count').value).toBe(5);
    expect(a.number('$team.count').value).toBe(3);
    a.list('$items').set([{ count: 8 }, { count: 11 }]);
    p.step(0);
    expect(a.number('$items.length').value).toBe(2);
    expect(a.number('$items.1.count').value).toBe(11);
    a.number('$items.1.count').set(12);
    p.step(0);
    expect(a.get('$items')).toEqual([{ count: 8 }, { count: 12 }]);
    expect(() => a.list('$items').set([{ count: 'bad' }])).toThrow(DataError);
  });
  it('keeps named model references shared when created through data validation', () => {
    const raw = document();
    (raw.data.instances as Record<string, unknown>).item = { model: 'Item', values: { count: 6 } };
    const p = player(raw),
      a = p.data;
    const c = a.create('Score', { team: 'item' });
    a.bind(c);
    a.number('$item:count').set(10);
    p.step(0);
    expect(a.number('$team.count').value).toBe(10);
  });
  it('notifies once for host/native triggers after the step and supports unsubscribe', () => {
    const p = player(),
      a = p.data;
    a.bind('main');
    const trigger = a.trigger('$pulse'),
      callback = vi.fn();
    const off = trigger.on('change', callback);
    expect(trigger.value).toBeUndefined();
    trigger.fire();
    trigger.fire();
    expect(callback).not.toHaveBeenCalled();
    p.step(0);
    expect(callback.mock.calls).toEqual([[undefined]]);
    p.fire('$pulse');
    p.step(0);
    expect(callback).toHaveBeenCalledTimes(2);
    off();
    off();
    trigger.fire();
    p.step(0);
    expect(callback).toHaveBeenCalledTimes(2);
  });
  it('batches nested writes and wake requests, returns values, and preserves writes on throw', () => {
    const p = player(),
      a = p.data;
    a.bind('main');
    p.onChange = vi.fn();
    const callback = vi.fn();
    a.number('$score').on('change', callback);
    expect(
      a.batch(() => {
        a.number('$score').set(5);
        return a.batch(() => {
          a.number('$score').set(8);
          return 42;
        });
      }),
    ).toBe(42);
    expect(p.onChange).toHaveBeenCalledTimes(1);
    expect(callback).not.toHaveBeenCalled();
    p.step(0);
    expect(callback.mock.calls).toEqual([[8]]);
    expect(() =>
      a.batch(() => {
        a.number('$score').set(9);
        throw Error('stop');
      }),
    ).toThrow('stop');
    p.step(0);
    expect(a.get('$score')).toBe(9);
    expect(() => a.batch(() => p.step(0))).toThrow('step inside data.batch');
  });
  it('observes native input writes and the final reverse binding result', () => {
    const raw = document();
    raw.bind['dot.r'] = { value: '$score', mode: 'to-source' } as never;
    const p = player(raw),
      a = p.data;
    a.bind('main');
    const callback = vi.fn();
    a.number('$score').on('change', callback);
    p.set('$score', 7);
    p.step(0);
    expect(callback.mock.calls).toEqual([[1]]);
  });
});
it('indexes heterogeneous list items and references host-created instances', () => {
  const raw = document();
  (raw.data.models.Score.properties.items as { of?: string }).of = undefined;
  raw.data.instances.main.values.items = [{ model: 'Item', values: { count: 6 } }] as never;
  // JSON's absence of optional fields is preserved; data's checker rejects explicit undefined.
  delete (raw.data.models.Score.properties.items as { of?: string }).of;
  const p = player(raw),
    a = p.data;
  a.bind('main');
  expect(a.number('$items.0.count').value).toBe(6);
  a.list('$items').set([{ model: 'Item', values: { count: 9 } }]);
  p.step(0);
  expect(a.number('$items.0.count').value).toBe(9);
  const item = a.create('Item', { count: 12 }),
    root = a.create('Score', { items: [item.name], team: item.name });
  a.bind(root);
  expect(a.number('$items.0.count').value).toBe(12);
  a.number('$' + item.name + ':count').set(15);
  p.step(0);
  expect(a.number('$team.count').value).toBe(15);
});
it('fires bound created-instance triggers through the native state machine and isolates named subscriptions', () => {
  const raw = document();
  (raw as Record<string, unknown>).machine = {
    layers: {
      base: {
        initial: 'idle',
        states: {
          idle: { pose: {}, on: [{ to: 'active', when: '$pulse' }] },
          active: { pose: { 'dot.r': 3 } },
        },
      },
    },
  };
  const p = player(raw),
    a = p.data,
    c = a.create('Score');
  a.bind(c);
  const got: unknown[] = [],
    named: unknown[] = [];
  a.trigger('$pulse').on('change', (v) => got.push(v));
  a.trigger('$main:pulse').on('change', (v) => named.push(v));
  a.trigger('$pulse').fire();
  p.step(0);
  expect(p.states().base).toBe('active');
  expect(got).toEqual([undefined]);
  expect(named).toEqual([]);
});
it('rejects foreign instance handles and prototype model names', () => {
  const p = player(),
    q = new Player(p.model);
  expect(() => p.data.bind(q.data.instances()[0]!)).toThrow(DataError);
  expect(() => p.data.create('constructor')).toThrow(DataError);
});
it('forwards a rebound authored trigger into default guards without false signals on bind', () => {
  const raw = document();
  (raw as Record<string, unknown>).machine = {
    layers: {
      base: {
        initial: 'idle',
        states: {
          idle: { pose: {}, on: [{ to: 'active', when: '$pulse' }] },
          active: { pose: {} },
        },
      },
    },
  };
  const p = player(raw),
    a = p.data;
  a.bind('main');
  const got: unknown[] = [];
  const t = a.trigger('$pulse');
  t.on('change', (v) => got.push(v));
  t.fire();
  p.step(0);
  expect(got).toEqual([undefined]);
  a.bind('other');
  p.step(0);
  expect(got).toEqual([undefined]);
  t.fire();
  p.step(0);
  expect(got).toEqual([undefined, undefined]);
  const q = player(raw),
    b = q.data;
  b.bind('other');
  b.trigger('$pulse').fire();
  q.step(0);
  expect(q.states().base).toBe('active');
});
it('round-trips detached heterogeneous lists and accepts owned instance handles as references', () => {
  const raw = document();
  raw.data.instances.main.values.items = [];
  (raw.data.models.Item.properties as Record<string, unknown>).values = {
    type: 'string',
    default: 'kept',
  };
  delete (raw.data.models.Score.properties.items as { of?: string }).of;
  const p = player(raw),
    a = p.data;
  a.bind('main');
  a.list('$items').set([{ model: 'Item', values: { count: 8 } }]);
  p.step(0);
  const cancel = a.list('$items').on('change', (v) => a.list('$items').set(v));
  a.list('$items').set([{ model: 'Item', values: { count: 9 } }]);
  p.step(0);
  p.step(0);
  cancel();
  a.list('$items').set([{ model: 'Item', values: { count: 8 } }]);
  p.step(0);
  const value = a.list('$items').value;
  a.list('$items').set(value);
  p.step(0);
  expect(a.get('$items.0.count')).toBe(8);
  expect(a.get('$items.0.values')).toBe('kept');
  const item = a.create('Item', { count: 12 }),
    root = a.create('Score', { team: item, items: [item] });
  a.bind(root);
  a.number('$' + item.name + ':count').set(15);
  p.step(0);
  expect(a.get('$team.count')).toBe(15);
  expect(a.get('$items.0.count')).toBe(15);
});

it('ignores data property comments while indexing runtime models', () => {
  const raw = document();
  (raw.data.models.Score.properties as Record<string, unknown>).$comment = null;
  const p = player(raw);
  p.data.bind('main');
  expect(p.data.number('$score').value).toBe(4);
});
