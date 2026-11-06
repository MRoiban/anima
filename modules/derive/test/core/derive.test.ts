import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import { createScope } from '../../../data/core/storage.ts';
import { dataState } from '../../../data/core/index.ts';
import type { HostData } from '../../../host/core/api.ts';
const doc = () => ({
  anima: '0.1',
  name: 'derived',
  grid: 20,
  requires: ['data', 'bind', 'derive', 'convert', 'host', 'events', 'input'],
  nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1, properties: { label: '' } }],
  data: {
    models: {
      Player: {
        properties: {
          score: { type: 'number' },
          label: { type: 'string', value: '$score', convert: 'points' },
          double: { type: 'number', value: '$score * 2' },
          winner: { type: 'bool', value: '$double >= 100 and not ($score == 60)' },
          absolute: { type: 'number', value: '$main:bonus + $score' },
        },
      },
      Board: {
        properties: {
          bonus: { type: 'number', default: 5 },
          players: { type: 'list', of: 'Player' },
        },
      },
    },
    instances: {
      main: {
        model: 'Board',
        default: true,
        values: { players: [{ score: 1250 }, { score: 980 }, { score: 40 }] },
      },
    },
  },
  converters: {
    fmt: { type: 'number-format', grouping: true, decimals: 0 },
    suffix: { type: 'template', text: '{0} pts' },
    points: { chain: ['fmt', 'suffix'] },
  },
  bind: { 'dot.properties.label': '$players.0.label', 'dot.x': '$players.0.winner' },
});
function player(raw: object = doc()) {
  const r = load(raw);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
}
it('computes per list item with independent players, chained and absolute expressions', () => {
  const p = player(),
    q = new Player(p.model);
  p.step(0);
  q.step(0);
  expect([0, 1, 2].map((i) => p.get(`$players.${i}.label`))).toEqual([
    '1,250 pts',
    '980 pts',
    '40 pts',
  ]);
  expect(p.get('$players.0.absolute')).toBe(1255);
  expect(p.value('dot.x')).toBe(1);
  p.set('$players.0.score', 60);
  p.step(0);
  expect(p.get('$players.0.double')).toBe(120);
  expect(p.get('$players.0.winner')).toBe(false);
  expect(p.get('$players.0.label')).toBe('60 pts');
  expect(p.value('dot.properties.label')).toBe('60 pts');
  expect(q.get('$players.0.label')).toBe('1,250 pts');
});
it('host reads bare paths, rejects writes and notifies once after resolution', () => {
  const p = player();
  const api = (p as Player & { data: HostData }).data;
  api.bind('main');
  const label = api.string('players.0.label');
  const seen: string[] = [];
  label.on('change', (v) => seen.push(v));
  expect(() => label.set('bad')).toThrowError(
    expect.objectContaining({
      code: 'read-only-path',
      hint: expect.any(String),
      pointer: '/data/$players.0.label',
    }),
  );
  expect(() => p.set('$players.0.label', 'bad')).toThrow(/read-only \(read-only-path\)/);
  api.number('$players.0.score').set(1000);
  api.number('$players.0.score').set(1500);
  p.step(0);
  expect(label.value).toBe('1,500 pts');
  expect(seen).toEqual(['1,500 pts']);
});
it.each(['set', 'copy', 'two-way', 'to-source', 'initial', 'toggle', 'write'])(
  'rejects %s to a computed destination with pointer/message/hint',
  (kind) => {
    const raw: Record<string, unknown> = doc();
    if (kind === 'set') raw.listeners = [{ on: 'click', set: { '$players.0.label': '"bad"' } }];
    if (kind === 'copy')
      raw.listeners = [{ on: 'click', copy: '$players.1.label -> $players.0.label' }];
    if (kind === 'toggle') raw.listeners = [{ on: 'click', toggle: '$players.0.winner' }];
    if (kind === 'write') raw.listeners = [{ on: 'click', write: { x: '$players.0.double' } }];
    if (kind === 'initial')
      (raw.data as ReturnType<typeof doc>['data']).instances.main.values.players[0] = {
        score: 1,
        label: 'bad',
      } as never;
    if (kind === 'two-way' || kind === 'to-source')
      raw.bind = { 'dot.x': { value: '$players.0.double', mode: kind } };
    const r = load(raw);
    expect(r.model).toBeUndefined();
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'read-only-path',
        pointer: expect.stringMatching(/^\//),
        message: expect.stringMatching(/read-only/),
        hint: expect.stringContaining('source'),
      }),
    );
  },
);
it('diagnoses cycles and wrong types', () => {
  const raw = doc();
  raw.data.models.Player.properties.double.value = '$absolute';
  raw.data.models.Player.properties.absolute.value = '$double';
  expect(load(raw).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'derive-cycle',
      pointer: '/data/models/Player/properties/double/value',
      hint: expect.any(String),
    }),
  );
  raw.data.models.Player.properties.double.value = '"bad"';
  expect(load(raw).diagnostics).toContainEqual(expect.objectContaining({ code: 'derive-type' }));
});
it('validates missing converters', () => {
  const raw = doc();
  raw.data.models.Player.properties.label.convert = 'absent';
  expect(load(raw).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'derive-converter',
      pointer: '/data/models/Player/properties/label/convert',
      hint: expect.any(String),
    }),
  );
});
it('round trips AniML property expressions in both spellings', () => {
  const raw = doc();
  const xml = decompile(raw);
  const result = compile(xml);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = player(result.doc!);
  p.step(0);
  expect(p.get('$players.1.label')).toBe('980 pts');
});
it('installs no compute wrapper for documents with no computed declarations', () => {
  const raw = doc();
  for (const p of Object.values(raw.data.models.Player.properties)) {
    Reflect.deleteProperty(p, 'value');
    Reflect.deleteProperty(p, 'convert');
  }
  const p = player(raw);
  expect(dataState(p)).toBeDefined();
  expect(p.model.inputScope).toBe(createScope);
  expect(dataState(p)?.modelTypes).toBeUndefined();
});
it('supports every scalar kind, literal expression spelling, and aliases', () => {
  const result = compile(`<anima version="0.1" name="scalars" grid="20" requires="data bind derive">
 <model name="P"><number name="n" default="3"/><number name="twice" value="$n * 2"/><number name="constant" value="12"/><string name="label" value='"Ada"'/><bool name="flag" value="$n > 1"/><color name="tint" value="#ff0000"/><enum name="mood" values="calm happy" value='"happy"'/></model>
 <instance name="main" model="P" default="true"/><instance name="other" model="P"><set path="n" value="4"/></instance>
 <circle id="dot" cx="10" cy="10" r="1" fill="#000"/>
 </anima>`);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = player(result.doc!);
  p.step(0);
  expect(
    ['$twice', '$constant', '$label', '$flag', '$tint', '$mood', '$other:twice'].map((path) =>
      p.get(path),
    ),
  ).toEqual([6, 12, 'Ada', true, [255, 0, 0, 255], 'happy', 8]);
});
it('reports a cycle even on a model with no instances', () => {
  const raw = doc();
  (raw.data.models as Record<string, unknown>).Unused = {
    properties: { a: { type: 'number', value: '$b' }, b: { type: 'number', value: '$a' } },
  };
  expect(load(raw).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'derive-cycle',
      pointer: '/data/models/Unused/properties/a/value',
      hint: expect.any(String),
    }),
  );
});
it('keeps initial change listeners quiet and emits computed event fields after the binding pass', () => {
  const raw = doc() as Record<string, unknown>;
  raw.listeners = [
    { on: 'change:$players.0.label', set: { $bonus: '$bonus+1' } },
    { on: 'click', set: { '$players.0.score': 1500 }, emit: 'label' },
  ];
  raw.eventDefs = {
    label: { payload: { value: { type: 'string', input: '$players.0.label' } } },
  };
  const p = player(raw);
  expect(p.step(0).settled).toBe(true);
  expect(p.get('$bonus')).toBe(5);
  p.act(p.model.listeners[1]!);
  const step = p.step(0);
  expect(step.events).toContainEqual(
    expect.objectContaining({ name: 'label', payload: { value: '1,500 pts' } }),
  );
  expect(p.get('$bonus')).toBe(5);
  p.step(0);
  expect(p.get('$bonus')).toBe(6);
});
it('computes host-created instances and replacement lists after loading', () => {
  const p = player();
  const api = p.data;
  api.bind('main');
  const created = api.create('Board', {
    bonus: 10,
    players: [{ score: 700 }, { score: 1 }, { score: 3 }],
  });
  api.bind(created);
  p.step(0);
  expect(api.string('players.0.label').value).toBe('700 pts');
  api.number('players.0.score').set(900);
  p.step(0);
  expect(api.string('players.0.label').value).toBe('900 pts');
  api.list('players').set([{ score: 1600 }, { score: 4 }, { score: 5 }]);
  p.step(0);
  expect(api.string('players.0.label').value).toBe('1,600 pts');
});
it('reports invalid computed non-scalars and missing bind feature', () => {
  const raw = doc();
  (raw.data.models.Player.properties as Record<string, unknown>).bad = {
    type: 'list',
    of: 'Player',
    value: '$score',
  };
  expect(load(raw).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'derive-type',
      pointer: '/data/models/Player/properties/bad/value',
      hint: expect.any(String),
    }),
  );
  const other = doc();
  other.requires = other.requires.filter((x) => x !== 'bind');
  expect(load(other).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'undeclared-feature' }),
  );
});
it('names unsupported tokens in data binding syntax hints', () => {
  const raw = { ...doc(), bind: { 'dot.x': '$players.0.score % 2' } };
  expect(load(raw).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'bind-syntax',
      pointer: '/bind/dot.x',
      hint: expect.stringContaining('%'),
    }),
  );
});
it.each(['$score % 2', '"bad\\q"'])(
  'reports malformed computed expression %s as a complete diagnostic',
  (source) => {
    const raw = doc();
    raw.data.models.Player.properties.label.value = source;
    expect(load(raw).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'bind-syntax',
        pointer: '/data/models/Player/properties/label/value',
        message: expect.any(String),
        hint: expect.stringContaining('comparisons'),
      }),
    );
  },
);
it('does not borrow an authored converter from a previously loaded document', () => {
  player(doc());
  const raw = doc();
  Reflect.deleteProperty(raw.converters, 'points');
  expect(load(raw).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'derive-converter',
      pointer: '/data/models/Player/properties/label/convert',
      hint: expect.any(String),
    }),
  );
});
it('validates computed numbers from their expression instead of the fallback zero, then clamps', () => {
  const raw = {
    anima: '0.1',
    name: 'bounded-derived',
    grid: 20,
    requires: ['data', 'bind', 'derive'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    data: {
      models: {
        P: {
          properties: {
            n: { type: 'number', default: 3 },
            bounded: { type: 'number', min: 10, max: 20, value: '$n * 4' },
          },
        },
      },
    },
  };
  const p = player(raw);
  expect(p.get('$bounded')).toBe(12);
  p.set('$n', 10);
  p.step(0);
  expect(p.get('$bounded')).toBe(20);
  p.set('$n', -10);
  p.step(0);
  expect(p.get('$bounded')).toBe(10);
});
it('coerces bool-valued computed number expressions to 0/1', () => {
  const raw = doc();
  (raw.data.models.Player.properties as Record<string, unknown>).numeric = {
    type: 'number',
    value: '$score >= 1000',
  };
  const p = player(raw);
  p.step(0);
  expect(p.get('$players.0.numeric')).toBe(1);
  expect(p.get('$players.2.numeric')).toBe(0);
  p.set('$players.2.score', 1500);
  p.step(0);
  expect(p.get('$players.2.numeric')).toBe(1);
});
