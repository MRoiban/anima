import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { compile, decompile, formatMarkup } from '@anima-format/markup';
import { run } from '../../../../packages/cli/src/index.ts';
import { expression, evaluate } from '../../core/expression.ts';

const types = new Map([
  ['$label', 'string'],
  ['$query', 'string'],
]);
const scope = new Map([
  ['$label', 'Sound'],
  ['$query', 'SO'],
]);

describe('typed string functions', () => {
  it.each([
    ['contains("Sound", "oun")', 'bool', true],
    ['contains("Sound", "SO")', 'bool', false],
    ['contains("", "")', 'bool', true],
    ['contains("Sound", "")', 'bool', true],
    ['contains("", "s")', 'bool', false],
    ['contains("Sound", "Sound longer")', 'bool', false],
    ['contains(" a b ", "a b")', 'bool', true],
    ['contains("a", " a")', 'bool', false],
    ['contains("🔔x", "🔔")', 'bool', true],
    ['contains("é", "é")', 'bool', false],
    ['lower("")', 'string', ''],
    ['lower(" Sound ÉCOLE ΣΟΣ İ ẞ 🔔 ")', 'string', ' sound école σος i̇ ß 🔔 '],
    ['contains(lower($label), lower($query))', 'bool', true],
    ['lower(lower($label))', 'string', 'sound'],
    ['contains(lower("ẞ"), "ss")', 'bool', false],
    ['not contains(lower($label), "missing") and lower($query) == "so"', 'bool', true],
    ['contains(lower($label), lower($query)) + 2', 'number', 3],
  ])('%s has type %s and value %s', (source, type, value) => {
    const parsed = expression(source as string, types);
    expect(parsed.type).toBe(type);
    expect(evaluate(parsed, scope)).toBe(value);
  });

  it.each([
    ['lower()', 'bind-syntax'],
    ['lower("x", "y")', 'bind-syntax'],
    ['contains("x")', 'bind-syntax'],
    ['contains("x", "y", "z")', 'bind-syntax'],
    ['lower(1)', 'bind-type'],
    ['lower(1 == 1)', 'bind-type'],
    ['lower(#fff)', 'bind-type'],
    ['contains(1, "x")', 'bind-type'],
    ['contains("x", 1)', 'bind-type'],
    ['contains(1 == 1, "x")', 'bind-type'],
    ['contains("x", 1 == 1)', 'bind-type'],
    ['contains(#fff, "x")', 'bind-type'],
    ['contains("x", #fff)', 'bind-type'],
    ['lower(contains("a", "a"))', 'bind-type'],
    ['contains(lower("a"), lower(1))', 'bind-type'],
  ])('diagnoses %s at load time', (source, code) => {
    const result = load({
      anima: '0.1',
      name: 'bad-string-call',
      grid: 20,
      requires: ['bind'],
      nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
      bind: { 'dot.visible': source },
    });
    expect(result.model).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer: '/bind/dot.visible',
        message: expect.stringMatching(/.+ at character \d+/),
        hint: expect.stringMatching(/.+/),
      }),
    );
  });

  it('locates the wrong string operand, including AniML source coordinates', () => {
    expect(() => expression('contains("x", 2)', types)).toThrowError(
      expect.objectContaining({ code: 'bind-type', at: 14, message: 'expected string' }),
    );
    const source = `<anima version="0.1" name="bad" grid="20" requires="bind">
  <circle id="dot" cx="10" cy="10" r="1"/>
  <bind target="dot.visible" value="contains(&quot;x&quot;, 2)"/>
</anima>`;
    expect(compile(source).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'bind-type',
        pointer: '/bind/dot.visible',
        line: 3,
        column: 37,
        message: 'expected string at character 15',
        hint: expect.stringMatching(/.+/),
      }),
    );
  });
});

const scene = {
  anima: '0.1',
  name: 'string-contexts',
  grid: 20,
  requires: ['data', 'bind', 'derive'],
  data: {
    models: {
      Search: {
        properties: {
          query: { type: 'string', default: 'SO' },
          label: { type: 'string', default: 'Sound' },
          copied: { type: 'string' },
          found: { type: 'bool' },
          shown: { type: 'bool', value: 'contains(lower($label), lower($query))' },
          count: { type: 'number', value: '$shown' },
        },
      },
    },
    instances: { main: { model: 'Search', default: true, values: {} } },
  },
  nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
  bind: { 'dot.visible': 'contains(lower($label), lower($query))' },
  listeners: [
    { on: 'click', set: { $copied: 'lower($label)', $found: 'contains(lower($label), "oun")' } },
  ],
  machine: {
    layers: {
      matches: {
        initial: 'idle',
        states: {
          idle: {
            pose: {},
            on: [{ when: '(contains(lower($label), lower($query)))', to: 'found' }],
          },
          found: { pose: {} },
        },
      },
    },
  },
};
it('shares the typed calls across bindings, string/bool set actions, derive and scalar guards', () => {
  const result = load(scene);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(result.model!);
  p.step(0);
  expect(p.states()).toEqual({ matches: 'found' });
  expect([p.value('dot.visible'), p.get('$shown'), p.get('$count')]).toEqual([true, true, 1]);
  p.act(p.model.listeners[0]!);
  p.step(0);
  expect([p.get('$copied'), p.get('$found')]).toEqual(['sound', true]);
  p.set('$query', 'no match');
  p.step(0);
  expect([p.value('dot.visible'), p.get('$shown'), p.get('$count')]).toEqual([false, false, 0]);
});

it.each(['binding', 'action', 'derive', 'guard'])(
  'rejects wrong operand types in a %s with an authored pointer and hint',
  (context) => {
    const doc = structuredClone(scene);
    const source = 'contains(lower($label), 1)';
    let pointer: string;
    if (context === 'binding') {
      doc.bind['dot.visible'] = source;
      pointer = '/bind/dot.visible';
    } else if (context === 'action') {
      doc.listeners[0]!.set.$found = source;
      pointer = '/listeners/0/set/$found';
    } else if (context === 'derive') {
      doc.data.models.Search.properties.shown.value = source;
      pointer = '/data/models/Search/properties/shown/value';
    } else {
      doc.machine.layers.matches.states.idle.on[0]!.when = '(' + source + ')';
      pointer = '/machine/layers/matches/states/idle/on/0/when';
    }
    const result = load(doc);
    expect(result.model).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'bind-type',
        pointer,
        message: expect.stringContaining('expected string'),
        hint: expect.stringMatching(/.+/),
      }),
    );
  },
);

it('keeps the AniML/JSON expression spellings identical on round trip', () => {
  const markup = decompile(scene);
  const result = compile(markup);
  expect(result.diagnostics).toEqual([]);
  expect(result.doc?.bind).toEqual(scene.bind);
  expect(result.doc?.listeners).toEqual(scene.listeners);
  expect(result.doc?.data).toEqual(scene.data);
  expect(formatMarkup(markup).text).toBe(markup);
});

it.each(['bind', 'data', 'filtering-a-list-by-typed-text'])(
  'anima docs %s exposes the filtering recipe',
  async (topic) => {
    const output: string[] = [];
    const code = await run(['docs', topic], {
      out: (s) => output.push(s),
      err: (s) => output.push(s),
    });
    expect(code, output.join('\n')).toBe(0);
    const text = output.join('\n');
    expect(text).toContain('Filtering a list by typed text');
    expect(text).toContain('contains(lower($label');
    expect(text).toContain('$count');
  },
);

it('the served bind recipe uses the complete shipped example', async () => {
  const output: string[] = [];
  await run(['docs', 'bind'], { out: (s) => output.push(s), err: (s) => output.push(s) });
  const recipe = /```xml\n([^]*?)\n```/.exec(output.join('\n'))![1]!;
  const source = readFileSync(
    new URL('../../examples/filtering-list.animl', import.meta.url),
    'utf8',
  );
  expect(compile(recipe).doc).toEqual(compile(source).doc);
});
