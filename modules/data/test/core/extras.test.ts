import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import { dataState } from '../../core/index.ts';

export const base = () => ({
  anima: '0.1',
  name: 'extras',
  grid: 20,
  requires: ['data', 'bind', 'convert'],
  data: {
    models: {
      Root: {
        properties: {
          number: { type: 'number', default: 0 },
          ready: { type: 'bool' },
          pulse: { type: 'trigger' },
          mood: { type: 'enum', values: ['calm', 'happy'] },
          text: { type: 'string', default: 'a && b' },
          tint: { type: 'color', default: '#d97757' },
          avatar: { type: 'asset-ref', assetType: 'image' },
        },
      },
    },
    instances: {
      main: { model: 'Root', default: true, exported: true },
      private: { model: 'Root' },
    },
  },
  nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
});
export function create(raw: object) {
  const r = load(raw);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
}
export function machine(when: string) {
  return {
    layers: {
      status: {
        initial: 'idle',
        states: {
          idle: { pose: { 'dot.r': 1 }, on: [{ when, to: 'done' }] },
          done: { pose: { 'dot.r': 2 } },
        },
      },
    },
  };
}
it('typed guards evaluate JSON/markup, escapes, colours and quoted conjunctions without bind growth', () => {
  const guards = ['$ready == false', '$mood == "calm"', '$text == "a && b"', '$tint == #d97757ff'];
  for (const when of guards) {
    const raw = { ...base(), machine: machine(when) };
    for (const doc of [raw, compile(decompile(raw)).doc!]) {
      const p = create(doc);
      p.step(0);
      expect(p.states()).toEqual({ status: 'done' });
    }
  }
});
it.each([
  '$mood == "missing"',
  '$ready == "true"',
  '$tint < #d97757',
  '$avatar == asset("missing")',
  '$tint == #xyz',
])('reports typed literal errors at the guard: %s', (when) => {
  const r = load({ ...base(), machine: machine(when) });
  expect(r.model).toBeUndefined();
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'data-guard',
      pointer: '/machine/layers/status/states/idle/on/0/when',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
  const d = r.diagnostics.find((d) => d.code === 'data-guard')!;
  expect(d.message.length).toBeGreaterThan(0);
  expect(d.hint!.length).toBeGreaterThan(0);
});
it('trigger destinations baseline, queue, coalesce, isolate players and respect once', () => {
  const raw = {
    ...base(),
    converters: { pulse: { type: 'trigger' } },
    bind: { $pulse: { value: '$number', convert: 'pulse' } },
    machine: machine('$pulse'),
  };
  const p = create(raw),
    q = new Player(p.model);
  expect(p.step(0).settled).toBe(true);
  expect(p.states().status).toBe('idle');
  p.set('$number', 1.1);
  expect(p.step(0).settled).toBe(false);
  expect(p.states().status).toBe('idle');
  p.step(0);
  expect(p.states().status).toBe('done');
  q.step(0);
  expect(q.states().status).toBe('idle');
  const once = create({
    ...raw,
    bind: { $pulse: { value: '$number', convert: 'pulse', mode: 'once' } },
  });
  once.step(0);
  once.set('$number', 2);
  once.step(0);
  once.step(0);
  expect(once.states().status).toBe('idle');
});
it('rejects reverse trigger destinations with a useful pointer', () => {
  const r = load({ ...base(), bind: { $pulse: { value: '$number', mode: 'two-way' } } });
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'data-binding',
      pointer: '/bind/$pulse/mode',
      hint: expect.any(String),
    }),
  );
});
it('export="true" round trips to exported metadata and discovers only explicit authored exports', () => {
  const raw = base(),
    xml = decompile(raw);
  expect(xml).toContain('export="true"');
  const r = compile(xml);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(dataState(create(r.doc!))!.exports()).toEqual([{ name: 'main', model: 'Root' }]);
  expect(dataState(create(raw))!.exports()).toEqual([{ name: 'main', model: 'Root' }]);
  const invalid = base();
  Object.assign(invalid.data.instances.main, { exported: 'yes' });
  expect(load(invalid).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'type', pointer: '/data/instances/main/exported' }),
  );
});

it.each(['legacy', 'dot.properties.signal'])(
  'delivers converted changes to trigger destination %s',
  (target) => {
    const raw = base();
    const nodes = [{ ...raw.nodes[0], properties: { signal: { type: 'trigger' } } }];
    const p = create({
      ...raw,
      nodes,
      inputs: { legacy: { type: 'trigger' } },
      bind: { [target]: '$number' },
      machine: machine(target),
    });
    p.step(0);
    p.set('$number', 1);
    p.step(0);
    expect(p.states().status).toBe('idle');
    p.step(0);
    expect(p.states().status).toBe('done');
  },
);

it('treats escaped quotes, dollar paths and conjunctions inside guard string literals as text', () => {
  const raw = base();
  raw.data.models.Root.properties.text.default = 'a "$unknown" && b';
  const p = create({ ...raw, machine: machine('$text == "a \\"$unknown\\" && b"') });
  p.step(0);
  expect(p.states().status).toBe('done');
});

it('compiles direct typed data literals without declaring bind', () => {
  const raw = base();
  raw.requires = ['data'];
  const p = create({ ...raw, machine: machine('$ready == true') });
  p.step(0);
  expect(p.states().status).toBe('idle');
  p.set('$ready', true);
  p.step(0);
  expect(p.states().status).toBe('done');
});
