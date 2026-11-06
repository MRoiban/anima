import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { printable } from '../../core/storage.ts';
it('matches eight independently captured native scalar values exactly', () => {
  const raw = {
    anima: '0.1',
    name: 'oracle',
    grid: 20,
    requires: ['data'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    data: {
      models: {
        Score: {
          properties: {
            score: { type: 'number', default: 4 },
            label: { type: 'string', default: 'Ada' },
            active: { type: 'bool' },
            tint: { type: 'color', default: '#11223344' },
          },
        },
      },
    },
  };
  const r = load(raw);
  expect(r.model).toBeDefined();
  const p = new Player(r.model!);
  for (const name of ['initial', 'changed']) {
    if (name === 'changed') {
      p.set('$score', 9);
      p.set('$label', 'Grace');
      p.set('$active', true);
      p.set('$tint', '#aabbccdd');
      p.step(0);
    }
    const native = JSON.parse(
      readFileSync(new URL('../../oracle/rive/frames/' + name + '.json', import.meta.url), 'utf8'),
    );
    for (const v of native.viewModel.properties) {
      const actual = printable(p.get('$' + v.path)!);
      expect(actual).toBe(
        v.type === 'color'
          ? '#' + v.value.slice(2).toLowerCase() + v.value.slice(0, 2).toLowerCase()
          : v.value,
      );
    }
  }
});
it('matches native nested model, list, enum key, index and member observations', () => {
  const raw = {
    anima: '0.1',
    name: 'refs',
    grid: 20,
    requires: ['data'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    data: {
      models: {
        Root: {
          properties: {
            team: { type: 'model-ref', model: 'Team' },
            items: { type: 'list', of: 'Team' },
            mood: { type: 'enum', enum: 'Mood' },
          },
        },
        Team: { properties: { title: { type: 'string', default: 'Blue' } } },
      },
      enums: {
        Mood: [
          { key: 'calm', label: 'Calm' },
          { key: 'happy', label: 'Happy' },
        ],
      },
      instances: {
        main: { model: 'Root', default: true, values: { team: 'blue', items: ['blue'] } },
        blue: { model: 'Team' },
      },
    },
  };
  const p = new Player(load(raw).model!);
  const native = JSON.parse(
    readFileSync(
      new URL('../../oracle/reference/rive/frames/initial.json', import.meta.url),
      'utf8',
    ),
  ).viewModel.properties;
  const team = native.find((x: { name: string }) => x.name === 'team'),
    list = native.find((x: { name: string }) => x.name === 'items'),
    mood = native.find((x: { name: string }) => x.name === 'mood');
  expect(p.get('$team.title')).toBe(team.value.properties[0].value);
  expect(p.get('$items.length')).toBe(list.size);
  expect(p.get('$items.0.title')).toBe(list.items[0].properties[0].value);
  expect(p.get('$mood')).toBe(mood.value);
  expect(mood.index).toBe(0);
  expect(mood.values).toEqual(['calm', 'happy']);
});
it('retains evidence that native system enum declarations expose no values in the CLI dump', () => {
  const d = JSON.parse(
    readFileSync(new URL('../../oracle/system/rive/frames/initial.json', import.meta.url), 'utf8'),
  );
  const enums = d.viewModel.properties.filter((x: { type: string }) => x.type === 'enum');
  expect(enums).toHaveLength(17);
  for (const e of enums) {
    expect(e.values).toEqual([]);
    expect(e.value).toBe('');
  }
});
it('retains the native asset-reference observation limit rather than fabricating values', () => {
  const d = JSON.parse(
    readFileSync(new URL('../../oracle/assets/rive/frames/initial.json', import.meta.url), 'utf8'),
  );
  for (const kind of ['image', 'font', 'blob']) {
    const p = d.viewModel.properties.find((p: { name: string }) => p.name === kind);
    expect(p.type).toBe(kind);
    expect(Object.hasOwn(p, 'value')).toBe(false);
  }
  const session = readFileSync(
    new URL('../../oracle/assets/rive/session.txt', import.meta.url),
    'utf8',
  );
  expect(session.match(/no property at this path/g)).toHaveLength(6);
});
