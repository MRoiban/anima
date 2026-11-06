import '@anima-format/core/all';
import { describe, it, expect } from 'vitest';
import { load, Player, runScript } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
export const document = {
  anima: '0.1',
  name: 'events',
  grid: 20,
  requires: ['events'],
  nodes: [{ id: 'a', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
  inputs: { count: { type: 'number' }, flag: { type: 'bool' }, go: { type: 'trigger' } },
  eventDefs: {
    ping: {
      payload: {
        count: { type: 'number', input: 'count' },
        flag: { type: 'bool', input: 'flag' },
        label: { type: 'string', value: 'hello' },
      },
    },
  },
  timelines: {
    t: {
      duration: 1,
      tracks: {},
      events: [
        [0, 'ping'],
        [0.5, 'ping'],
        [1, 'ping'],
      ],
    },
  },
  machine: {
    layers: {
      main: {
        initial: 'idle',
        states: {
          idle: { play: 't', on: [{ when: 'go', to: 'other', blend: 0.25 }] },
          other: { emit: 'ping', pose: {} },
        },
      },
    },
  },
};
describe('event definitions', () => {
  it('resolves typed inputs after queued writes; preserves event time/order and sample payloads', () => {
    const r = load(document);
    expect(r.diagnostics).toEqual([]);
    const p = new Player(r.model!);
    p.set('count', 4);
    p.set('flag', true);
    expect(p.step(0.5).events).toEqual(
      [0, 0.5].map((time) => ({
        name: 'ping',
        layer: 'main',
        time,
        payload: { count: 4, flag: true, label: 'hello' },
      })),
    );
    expect(p.step(0).events).toEqual([]);
    expect(p.step(0.5).events[0]?.time).toBe(1);
    const out = runScript(r.model!, 'set count 3\nadvance 0\nsnapshot').snapshots;
    expect(out[0]?.events[0]?.payload?.count).toBe(3);
  });
  it('reports exit/start/end around a fade exactly once, including zero dt', () => {
    const p = new Player(load(document).model!);
    p.step(0);
    p.fire('go');
    expect(p.step(0).events.map((e) => e.name)).toEqual([
      '@state-end',
      '@transition-start',
      'ping',
    ]);
    expect(p.step(0.24).events).toEqual([]);
    expect(p.step(0.01).events).toEqual([
      { name: '@transition-end', layer: 'main', time: 0, payload: { state: 'other' } },
    ]);
    expect(p.step(1).events).toEqual([]);
  });
  it('compiles/decompiles payloads in AniML', () => {
    const markup = decompile(document);
    expect(markup).toContain('event-def');
    const r = compile(markup);
    expect(r.diagnostics).toEqual([]);
    expect(r.doc?.eventDefs).toEqual(document.eventDefs);
  });
  it.each([
    [
      'event-payload',
      '/eventDefs/ping/payload/n',
      { payload: { n: { type: 'number', value: 'bad' } } },
    ],
    [
      'event-input',
      '/eventDefs/ping/payload/n/input',
      { payload: { n: { type: 'number', input: 'flag' } } },
    ],
    [
      'event-payload',
      '/eventDefs/ping/payload/n',
      { payload: { n: { type: 'number', value: 1, input: 'count' } } },
    ],
    ['event-url', '/eventDefs/ping/url', { url: 'javascript:alert(1)' }],
    ['event-url', '/eventDefs/ping/target', { target: '_blank' }],
    ['event-audio', '/eventDefs/ping/audio', { audio: 'missing' }],
  ])('rejects %s at %s', (code, pointer, def) => {
    const r = load({ ...document, eventDefs: { ping: def } });
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
  it('keeps base event records byte for byte when events are not required', () => {
    const { eventDefs: _defs, requires: _req, ...doc } = document;
    void _defs;
    void _req;
    const p = new Player(load(doc).model!);
    expect(p.step(0.5).events).toEqual([
      { name: 'ping', layer: 'main', time: 0 },
      { name: 'ping', layer: 'main', time: 0.5 },
    ]);
  });
});
it.each(['loop', 'pingpong'])(
  'reports each %s boundary once and never on initial entry',
  (loop) => {
    const d = structuredClone(document);
    Object.assign(d.timelines.t, { loop });
    const p = new Player(load(d).model!);
    expect(p.step(0).events.map((e) => e.name)).toEqual(['ping']);
    expect(p.step(3).events.filter((e) => e.name === '@loop')).toHaveLength(3);
    expect(p.step(0).events).toEqual([]);
  },
);
it('shares motion work-area/reverse crossings and skips held clocks', () => {
  const d = structuredClone(document);
  d.requires.push('motion');
  Object.assign(d.timelines.t, { loop: 'pingpong', work: [0.25, 0.75], speed: -1 });
  const p = new Player(load(d).model!);
  p.step(0);
  expect(p.step(1.5).events.filter((e) => e.name === '@loop')).toHaveLength(3);
});
it('queues local event-listener actions for the next step without feedback recursion', () => {
  const d = { ...document, listeners: [{ on: 'event:ping', set: { count: 9 } }] };
  const p = new Player(load(d).model!);
  expect(p.step(0).events[0]?.payload?.count).toBe(0);
  expect(p.get('count')).toBe(0);
  expect(p.step(0).events).toEqual([]);
  expect(p.get('count')).toBe(9);
});
it('samples animated payload addresses after state resolution', () => {
  const d = structuredClone(document);
  Object.assign(d.timelines.t.tracks, {
    'a.x': [
      [0, 0],
      [1, 10],
    ],
  });
  Object.assign(d.eventDefs.ping.payload, { x: { type: 'number', address: 'a.x' } });
  const p = new Player(load(d).model!);
  expect(p.step(0.5).events.map((e) => e.payload?.x)).toEqual([5, 5]);
});
it('rejects unresolved event listeners and invalid payload addresses', () => {
  expect(
    load({ ...document, listeners: [{ on: 'event:missing', emit: 'ping' }] }).diagnostics,
  ).toContainEqual(
    expect.objectContaining({
      code: 'unknown-event',
      pointer: '/listeners/0/on',
      hint: expect.any(String),
    }),
  );
  expect(
    load({
      ...document,
      eventDefs: { ping: { payload: { x: { type: 'number', address: 'missing.x' } } } },
    }).diagnostics,
  ).toContainEqual(
    expect.objectContaining({
      code: 'event-address',
      pointer: '/eventDefs/ping/payload/x/address',
      hint: expect.any(String),
    }),
  );
});
it('validates resource audio volume and AniML round trips', () => {
  const d = {
    ...document,
    requires: ['events', 'assets'],
    assets: { tone: { type: 'audio', source: 'data:audio/wav;base64,AA==' } },
    audioVolumes: { tone: 0.3 },
  };
  expect(compile(decompile(d)).doc?.audioVolumes).toEqual({ tone: 0.3 });
  expect(load({ ...d, audioVolumes: { missing: 0.3 } }).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'event-audio',
      pointer: '/audioVolumes/missing',
      hint: expect.any(String),
    }),
  );
});
it('preserves resolved child payloads through component bubbling', () => {
  const child = {
    anima: '0.1',
    name: 'child',
    grid: 20,
    requires: ['events'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
    eventDefs: { ping: { payload: { n: { type: 'number', value: 8 } } } },
    machine: { layers: { l: { initial: 's', states: { s: { pose: {}, emit: 'ping' } } } } },
  };
  const r = load({
    anima: '0.1',
    name: 'parent',
    grid: 20,
    requires: ['events', 'components'],
    components: {
      child: {
        grid: child.grid,
        nodes: child.nodes,
        eventDefs: child.eventDefs,
        machine: child.machine,
      },
    },
    nodes: [{ id: 'child', type: 'instance', component: 'child' }],
  });
  expect(r.diagnostics).toEqual([]);
  expect(new Player(r.model!).step(0).events).toEqual([
    { name: 'child.ping', layer: 'child/l', time: 0, payload: { n: 8 } },
  ]);
});
it('gates local event listeners on the events feature', () => {
  const { requires: _req, eventDefs: _defs, ...d } = document;
  void _req;
  void _defs;
  expect(
    load({ ...d, listeners: [{ on: 'event:ping', emit: 'ping' }] }).diagnostics,
  ).toContainEqual(
    expect.objectContaining({
      code: 'undeclared-feature',
      pointer: '/listeners/0/on',
      hint: expect.any(String),
    }),
  );
});
it('diagnoses malformed and duplicate AniML definitions', () => {
  for (const children of [
    `<event-def name="ping" payload="bad"/>`,
    `<audio-volume asset="tone"/>`,
    `<event-def name="ping"/><event-def name="ping"/>`,
    `<audio-volume asset="tone" value="0.2"/><audio-volume asset="tone" value="0.3"/>`,
  ]) {
    const r = compile(
      `<anima version="0.1" name="bad" grid="20" requires="events"><circle id="a" cx="10" cy="10" r="1"/>${children}</anima>`,
    );
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code: children.includes('bad')
          ? 'event-payload'
          : children === '<audio-volume asset="tone"/>'
            ? 'missing-attribute'
            : 'duplicate-name',
        hint: expect.any(String),
      }),
    );
  }
});
it('omits payload map comments from delivered data', () => {
  const d = {
    ...document,
    eventDefs: { ping: { payload: { $comment: 'fields', n: { type: 'number', value: 1 } } } },
  };
  expect(new Player(load(d).model!).step(0).events[0]?.payload).toEqual({ n: 1 });
});
it('fires authored state-end and transition actions with their payloads', () => {
  const d = structuredClone(document);
  Object.assign(d.machine.layers.main.states.idle, { endEmit: 'exit' });
  Object.assign(d.machine.layers.main.states.idle.on[0]!, { startEmit: 'begin', endEmit: 'done' });
  Object.assign(d.eventDefs, { done: { payload: { ok: { type: 'bool', value: true } } } });
  const c = compile(decompile(d));
  expect(c.diagnostics).toEqual([]);
  const p = new Player(load(c.doc!).model!);
  p.step(0);
  p.fire('go');
  expect(p.step(0).events.map((e) => e.name)).toEqual([
    '@state-end',
    'exit',
    '@transition-start',
    'begin',
    'ping',
  ]);
  expect(p.step(0.25).events).toEqual([
    { name: '@transition-end', layer: 'main', time: 0, payload: { state: 'other' } },
    { name: 'done', layer: 'main', time: 0, payload: { ok: true } },
  ]);
});
it('exposes child action event names to existing scoped parent listeners', () => {
  const r = load({
    anima: '0.1',
    name: 'parent',
    grid: 20,
    requires: ['events', 'components'],
    inputs: { n: { type: 'number' } },
    components: {
      child: {
        grid: 20,
        inputs: { go: { type: 'trigger' } },
        nodes: [{ id: 'a', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
        machine: {
          layers: {
            l: {
              initial: 's',
              states: {
                s: { pose: {}, endEmit: 'done', on: [{ when: 'go', to: 'end' }] },
                end: { pose: {} },
              },
            },
          },
        },
      },
    },
    nodes: [{ id: 'child', type: 'instance', component: 'child' }],
    listeners: [{ on: 'child.done', set: { n: 4 } }],
  });
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  p.fire('child.go');
  expect(p.step(0).events.map((e) => e.name)).toContain('child.done');
  expect(p.get('n')).toBe(0);
  p.step(0);
  expect(p.get('n')).toBe(4);
});
