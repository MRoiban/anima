import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { player } from './fixture.ts';
it('fresh native color channels/hex, enum metadata/index and nested shared-list reads: 16 exact comparisons', () => {
  const p = player({
    anima: '0.1',
    name: 'native-edit',
    grid: 20,
    requires: ['data'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    data: {
      models: {
        Score: {
          properties: {
            tint: { type: 'color', default: '#11223344' },
            mood: { type: 'enum', values: ['calm', 'happy'] },
            team: { type: 'model-ref', model: 'Team' },
            items: { type: 'list', of: 'Team' },
          },
        },
        Team: { properties: { title: { type: 'string', default: 'Blue' } } },
      },
      instances: {
        main: { model: 'Score', default: true, values: { team: 'blue', items: ['blue'] } },
        blue: { model: 'Team' },
      },
    },
  });
  const a = p.data;
  for (const name of ['initial', 'changed']) {
    if (name === 'changed') {
      a.color('tint').set([170, 187, 204, 221]);
      a.enum('mood').index = 1;
      a.string('team.title').set('Gold');
      p.step(0);
    }
    const native = JSON.parse(
      readFileSync(new URL('../../oracle/rive/frames/' + name + '.json', import.meta.url), 'utf8'),
    ).viewModel;
    expect(a.defaultInstance()).toEqual({ name: native.name, model: native.viewModel });
    const prop = (key: string) => native.properties.find((v: { path: string }) => v.path === key);
    const argb = String(prop('tint').value);
    const rgba = [2, 4, 6, 0].map((i) => parseInt(argb.slice(i, i + 2), 16));
    expect(a.color('tint').rgba).toEqual(rgba);
    expect(a.color('tint').hex).toBe(
      '#' + argb.slice(2).toLowerCase() + argb.slice(0, 2).toLowerCase(),
    );
    expect(a.enum('mood').index).toBe(prop('mood').index);
    expect(a.enum('mood').values).toEqual(prop('mood').values);
    expect(a.enum('mood').value).toBe(prop('mood').value);
    expect(a.list('items').at(0).string('title').value).toBe(
      prop('items').items[0].properties[0].value,
    );
    expect(a.string('team.title').value).toBe(prop('team').value.properties[0].value);
  }
});
it('native command evidence retains list/instance mutation observation limits', () => {
  const session = readFileSync(new URL('../../oracle/rive/session.txt', import.meta.url), 'utf8');
  for (const verb of [
    'data-create',
    'data-bind',
    'data-add',
    'data-insert',
    'data-remove',
    'data-swap',
  ])
    expect(session).toContain('err ' + verb + ': unknown command');
  expect(session).toContain('err data: items: no property at this path');
  expect(session).toContain('err data: image: no property at this path');
});
