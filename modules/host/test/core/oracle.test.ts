import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { formatHex } from '../../../../packages/core/src/color.ts';
import type { Property } from '../../../data/core/types.ts';
import { document, player } from './fixture.ts';
interface NativeProperty {
  path: string;
  type: string;
  value: unknown;
  changed?: boolean;
}
const frame = (name: string) =>
  JSON.parse(
    readFileSync(new URL('../../oracle/rive/frames/' + name + '.json', import.meta.url), 'utf8'),
  ).viewModel.properties as NativeProperty[];
it('matches independent native scalar writes, nested/list aliases and change flags exactly', () => {
  const raw = document();
  const definitions = raw.data.models as unknown as Record<
    string,
    { properties: Record<string, Property> }
  >;
  definitions.Team = { properties: { title: { type: 'string', default: 'Blue' } } };
  definitions.Score!.properties.team = { type: 'model-ref', model: 'Team' };
  definitions.Score!.properties.items = { type: 'list', of: 'Team' };
  definitions.Score!.properties.tint = { type: 'color', default: '#11223344' };
  const instances = raw.data.instances as unknown as Record<string, unknown>;
  instances.main = {
    model: 'Score',
    default: true,
    values: { score: 4, team: 'blue', items: ['blue'] },
  };
  instances.blue = { model: 'Team' };
  const p = player(raw),
    a = p.data;
  a.bind('main');
  const changes: string[] = [];
  const paths = ['mood', 'score', 'label', 'active', 'tint'];
  a.enum('$mood').on('change', () => changes.push('mood'));
  a.number('$score').on('change', () => changes.push('score'));
  a.string('$label').on('change', () => changes.push('label'));
  a.boolean('$active').on('change', () => changes.push('active'));
  a.color('$tint').on('change', () => changes.push('tint'));
  let comparisons = 0;
  for (const name of ['initial', 'changed']) {
    if (name === 'changed') {
      a.batch(() => {
        a.number('$score').set(5);
        a.number('$score').set(9);
        a.string('$label').set('Grace');
        a.boolean('$active').set(true);
        a.color('$tint').set('#aabbccdd');
        a.enum('$mood').set('happy');
        a.string('$team.title').set('Gold');
      });
      p.step(0);
    }
    const native = frame(name);
    for (const path of paths) {
      const prop = native.find((p) => p.path === path)!;
      const expected =
        prop.type === 'color'
          ? '#' +
            String(prop.value).slice(2).toLowerCase() +
            String(prop.value).slice(0, 2).toLowerCase()
          : prop.value;
      const actual =
        prop.type === 'color'
          ? formatHex(a.get('$' + path) as [number, number, number, number])
          : a.get('$' + path);
      expect(actual).toEqual(expected);
      comparisons++;
    }
    const team = native.find((p) => p.path === 'team')!.value as { properties: NativeProperty[] };
    expect(a.get('$team.title')).toBe(team.properties[0]!.value);
    comparisons++;
    const items = native.find((p) => p.path === 'items')! as NativeProperty & {
      size: number;
      items: { properties: NativeProperty[] }[];
    };
    expect(a.number('$items.length').value).toBe(items.size);
    comparisons++;
    expect(a.get('$items.0.title')).toBe(items.items[0]!.properties[0]!.value);
    comparisons++;
  }
  expect(comparisons).toBe(16);
  expect(changes).toEqual(
    frame('changed')
      .filter((p) => p.changed)
      .map((p) => p.path),
  );
  p.step(0);
  expect(changes).toEqual(['mood', 'score', 'label', 'active', 'tint']);
  // Native flags persist; these are not JS callback counts.
  expect(frame('unchanged').filter((p) => p.changed).length).toBe(5);
});
it('compares host-fired trigger delivery against a native data change listener', () => {
  const reference = JSON.parse(
    readFileSync(new URL('../../oracle/trigger/rive/frames/changed.json', import.meta.url), 'utf8'),
  ).viewModel.properties as NativeProperty[];
  const p = player({
    anima: '0.1',
    name: 'host-trigger',
    grid: 20,
    requires: ['data'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    data: {
      models: { Model: { properties: { pulse: { type: 'trigger' }, n: { type: 'number' } } } },
    },
    listeners: [{ target: 'dot', on: 'change:$pulse', set: { $n: 9 } }],
  });
  const a = p.data;
  a.bind('default');
  let deliveries = 0;
  a.trigger('$pulse').on('change', () => deliveries++);
  a.trigger('$pulse').fire();
  p.step(0);
  p.step(0);
  expect(deliveries).toBe(1);
  expect(reference.find((p) => p.path === 'pulse')!.changed).toBe(true);
  expect(a.number('$n').value).toBe(reference.find((p) => p.path === 'n')!.value);
});
