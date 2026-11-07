import '@anima-format/core/all';
import { expect, it, vi } from 'vitest';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import { create, document } from './fixture.ts';
it('auto-typed nested paths, retained binding, exports and nested colors work in both syntaxes', () => {
  for (const raw of [document(), compile(decompile(document())).doc!]) {
    const p = create(raw);
    const api = p.data;
    api.bind('main');
    const name = api.at('team.lead.name');
    expect(name.type).toBe('string');
    if (name.type === 'string') name.set('Grace');
    api.color('team.lead.tint').set('#ff000080');
    expect(name.value).toBe('Ada');
    p.step(0);
    expect(name.value).toBe('Grace');
    expect(api.color('team.lead.tint').value).toEqual([255, 0, 0, 128]);
    api.bind('private');
    expect(name.value).toBe('Ada');
    const records = api.exportedInstances();
    expect(records).toEqual([{ name: 'main', model: 'Root' }]);
    (records[0] as { name: string }).name = 'mutated';
    expect(api.exportedInstances()[0]!.name).toBe('main');
    api.create('Root');
    expect(api.exportedInstances()).toHaveLength(1);
  }
});
it('batch wakes once and subscriptions observe only the complete resolved step', () => {
  const p = create(document()),
    api = p.data;
  api.bind('main');
  p.step(0);
  const wake = vi.fn();
  p.onChange = wake;
  const seen: unknown[] = [];
  api
    .number('a')
    .on('change', (value) => seen.push([value, api.number('b').value, p.value('dot.r')]));
  api.batch(() => {
    api.number('a').set(7);
    api.batch(() => api.number('a').set(9));
    api.number('b').set(8);
  });
  expect(wake).toHaveBeenCalledTimes(1);
  expect(seen).toEqual([]);
  p.step(0);
  expect(seen).toEqual([[9, 8, 9]]);
  p.step(0);
  expect(seen).toHaveLength(1);
});
it('compares two live paths, reevaluating after queued host writes', () => {
  const p = create({
    ...document(),
    machine: {
      layers: {
        main: {
          initial: 'idle',
          states: {
            idle: { pose: {}, on: [{ when: '$a > $b', to: 'done' }] },
            done: { pose: {}, on: [{ when: '$b > $a', to: 'idle' }] },
          },
        },
      },
    },
  });
  p.data.bind('main');
  p.step(0);
  expect(p.states()).toEqual({ main: 'idle' });
  p.data.number('a').set(6);
  p.step(0);
  expect(p.states()).toEqual({ main: 'done' });
  p.data.number('b').set(8);
  p.step(0);
  expect(p.states()).toEqual({ main: 'idle' });
});
it('invalid nested paths and wrong handle writes carry diagnostics', () => {
  const p = create(document());
  p.data.bind('main');
  for (const run of [
    () => p.data.at('team.missing'),
    () => p.data.number('team.lead.name'),
    () => p.data.at('team.lead.name').set(1 as never),
  ]) {
    try {
      run();
      throw Error('expected diagnostic');
    } catch (e) {
      expect(e).toMatchObject({
        code: expect.stringMatching(/^data-/),
        pointer: expect.stringMatching(/^\/data\//),
        message: expect.any(String),
        hint: expect.any(String),
      });
    }
  }
});
