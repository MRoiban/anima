import '@anima-format/core/all';
import { describe, it, expect } from 'vitest';
import { load, Player } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
import { expression, evaluate } from '../../core/expression.ts';

const base = {
  anima: '0.1',
  name: 'action-values',
  grid: 20,
  requires: ['bind', 'events'],
  nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 2, fill: { color: '#000' } }],
  inputs: {
    count: { type: 'number', min: 0, max: 20 },
    copy: { type: 'number' },
    flag: { type: 'bool' },
    go: { type: 'trigger' },
  },
  listeners: [
    { on: 'click', set: { count: 'count+1', copy: 'count' }, fire: 'go', emit: 'changed' },
  ],
};
const player = (doc: object = base) => {
  const r = load(doc);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
};
const click = (p: Player) => {
  p.pointer('down', 10, 10);
  p.pointer('up', 10, 10);
};

describe('input expression actions', () => {
  it('evaluates at execution, sequential actions see previous writes; each set map shares a snapshot', () => {
    const p = player();
    p.set('count', 4);
    click(p);
    click(p);
    expect(p.get('count')).toBe(0);
    expect(p.step(0).events.map((e) => e.name)).toEqual(['changed', 'changed']);
    expect(p.get('count')).toBe(6);
    expect(p.get('copy')).toBe(5);
    p.set('count', 20);
    click(p);
    p.step(0);
    expect(p.get('count')).toBe(20);
    expect(p.get('copy')).toBe(20);
  });
  it('preserves literal types, bool expressions and non-finite-to-zero before clamping', () => {
    const p = player({
      ...base,
      listeners: [
        { on: 'click', set: { count: '1/0', flag: 'flag' }, toggle: 'flag' },
        { on: 'click', set: { copy: 'flag' } },
      ],
    });
    click(p);
    p.step(0);
    expect([p.get('count'), p.get('flag'), p.get('copy')]).toEqual([0, true, 1]);
  });
  it('executes initial entry, exit, transition, target entry in order, once per entry', () => {
    const p = player({
      ...base,
      machine: {
        layers: {
          main: {
            initial: 'idle',
            states: {
              idle: {
                pose: {},
                entry: { set: { count: 1 } },
                exit: { set: { count: 'count+1' } },
                on: [
                  {
                    when: 'go',
                    to: 'next',
                    actions: { set: { count: 'count*2' }, emit: 'transition' },
                  },
                ],
              },
              next: {
                pose: {},
                entry: { set: { count: 'count+1', copy: 'count' }, emit: 'entry' },
              },
            },
          },
        },
      },
    });
    expect(p.get('count')).toBe(1);
    p.fire('go');
    expect(
      p
        .step(0)
        .events.filter((e) => !e.name.startsWith('@'))
        .map((e) => e.name),
    ).toEqual(['transition', 'entry']);
    expect([p.get('count'), p.get('copy')]).toEqual([5, 4]);
    p.step(0);
    expect(p.get('count')).toBe(5);
  });
  it('resolves event expressions after all actions and bindings, keeping brace strings literal', () => {
    const p = player({
      ...base,
      eventDefs: {
        changed: {
          payload: {
            n: { type: 'number', value: '{count*2}' },
            flag: { type: 'bool', value: '{flag}' },
            color: { type: 'color', value: '{mix(#000,#fff,0.5)}' },
            label: { type: 'string', value: '{count}' },
          },
        },
      },
    });
    click(p);
    expect(p.step(0).events[0]?.payload).toEqual({
      n: 2,
      flag: false,
      color: '#808080',
      label: '{count}',
    });
  });
  it('round trips expressions with spaces/commas, JSON machine action attributes, and event fields', () => {
    const doc = {
      ...base,
      listeners: [{ on: 'click', set: { count: 'max(count + 1, 0)', copy: 'floor(count / 5)' } }],
      machine: {
        layers: {
          main: {
            initial: 'idle',
            states: {
              idle: {
                pose: {},
                entry: { set: { count: 'count+1' } },
                exit: { set: { count: 2 } },
                on: [
                  {
                    when: 'go && mod(count, 5) == 0',
                    to: 'idle',
                    actions: { set: { copy: 'count' } },
                  },
                ],
              },
            },
          },
        },
      },
      eventDefs: { changed: { payload: { n: { type: 'number', value: '{count}' } } } },
    };
    const markup = decompile(doc);
    const result = compile(markup);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.doc?.listeners).toEqual(doc.listeners);
    expect(result.doc?.machine).toEqual(doc.machine);
    expect(result.doc?.eventDefs).toEqual(doc.eventDefs);
    expect(compile(markup.replace('max(count + 1, 0)', 'count + 1')).doc?.listeners).toEqual([
      { on: 'click', set: { count: 'count + 1', copy: 'floor(count / 5)' } },
    ]);
  });
  it('compares both arithmetic sides past ten without changing literal condition grammar', () => {
    const p = player({
      ...base,
      machine: {
        layers: {
          main: {
            initial: 'idle',
            states: {
              idle: {
                pose: {},
                on: [{ when: 'count > 0 && mod(count, 5) == floor(count/count) - 1', to: 'hit' }],
              },
              hit: { pose: {}, emit: 'milestone' },
            },
          },
        },
      },
    });
    for (const count of [11, 14, 16]) {
      p.set('count', count);
      expect(p.step(0).events).toEqual([]);
    }
    p.set('count', 15);
    expect(
      p
        .step(0)
        .events.filter((e) => !e.name.startsWith('@'))
        .map((e) => e.name),
    ).toEqual(['milestone']);
  });
  it('recognizes names emitted by every machine action block for event listeners', () => {
    const r = load({
      ...base,
      machine: {
        layers: {
          main: {
            initial: 'idle',
            states: {
              idle: {
                pose: {},
                entry: { emit: 'ready' },
                exit: { emit: 'bye' },
                on: [{ when: 'go', to: 'next', actions: { emit: 'cross' } }],
              },
              next: { pose: {} },
            },
          },
        },
      },
      listeners: ['ready', 'bye', 'cross'].map((name) => ({
        on: 'event:' + name,
        set: { count: 'count+1' },
      })),
    });
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const p = new Player(r.model!);
    expect(p.step(0).settled).toBe(false);
    p.step(0);
    expect(p.get('count')).toBe(1);
    p.fire('go');
    p.step(0);
    expect(p.get('count')).toBe(1);
    p.step(0);
    expect(p.get('count')).toBe(3);
  });
  it.each([
    ['unknown-input', 'mod(missing, 5) == 0'],
    ['bind-type', 'mod(go, 5) == 0'],
    ['bind-type', 'mix(#000,#fff,0.5) == 0'],
    ['bind-syntax', 'mod(count) == 0'],
    ['input-type', 'flag == 0'],
  ])('rejects condition %s: %s', (code, when) => {
    const r = load({
      ...base,
      machine: {
        layers: {
          main: {
            initial: 'idle',
            states: { idle: { pose: {}, on: [{ when, to: 'next' }] }, next: { pose: {} } },
          },
        },
      },
    });
    expect(r.model).toBeUndefined();
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({ code, pointer: '/machine/layers/main/states/idle/on/0/when' }),
    );
  });
  it('tracks expression-only input reads and retains literal set type errors', () => {
    const doc = {
      ...base,
      inputs: { count: { type: 'number' }, source: { type: 'number' } },
      listeners: [{ on: 'click', set: { count: 'source+1' } }],
    };
    expect(load(doc).diagnostics).toEqual([]);
    expect(
      load({ ...doc, listeners: [{ on: 'click', set: { count: true } }] }).model,
    ).toBeUndefined();
  });
  it.each([
    [
      'bind-type',
      '/listeners/0/set/count',
      { listeners: [{ on: 'click', set: { count: '#fff' } }] },
    ],
    [
      'bind-type',
      '/listeners/0/set/flag',
      { listeners: [{ on: 'click', set: { flag: 'count+1' } }] },
    ],
    [
      'unknown-input',
      '/listeners/0/set/count',
      { listeners: [{ on: 'click', set: { count: 'missing+1' } }] },
    ],
    ['input-type', '/listeners/0/set/go', { listeners: [{ on: 'click', set: { go: 'count' } }] }],
    ['bind-type', '/listeners/0/set/count', { listeners: [{ on: 'click', set: { count: 'go' } }] }],
    [
      'bind-syntax',
      '/listeners/0/set/count',
      { listeners: [{ on: 'click', set: { count: 'floor(count, 2)' } }] },
    ],
    [
      'undeclared-feature',
      '/listeners/0/set/count',
      { requires: [], listeners: [{ on: 'click', set: { count: 'count+1' } }] },
    ],
    [
      'unknown-input',
      '/eventDefs/changed/payload/n/value',
      { eventDefs: { changed: { payload: { n: { type: 'number', value: '{missing}' } } } } },
    ],
    [
      'bind-type',
      '/eventDefs/changed/payload/n/value',
      { eventDefs: { changed: { payload: { n: { type: 'bool', value: '{count}' } } } } },
    ],
  ])('rejects %s at %s', (code, pointer, patch) => {
    const r = load({ ...base, ...patch });
    expect(r.model).toBeUndefined();
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer,
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
});

describe('floor and Euclidean modulo', () => {
  it.each([
    ['floor(-1.2)', -2],
    ['mod(16,5)', 1],
    ['mod(-1,5)', 4],
    ['mod(1,-5)', -4],
    ['mod(1,0)', 0],
    ['floor(1/0)', 0],
  ])('%s = %s', (src, result) => {
    expect(evaluate(expression(src, new Map()), new Map())).toBe(result);
  });
});
