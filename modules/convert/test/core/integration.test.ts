import '@anima-format/core/all';
import { load, Player, registerModule } from '../../../../packages/core/src/index.ts';
import { describe, it, expect } from 'vitest';
const base = (defs: object, bindings: object, defaults = { x: 0, y: 10, bonus: 2 }) => ({
  anima: '0.1',
  name: 'integrated-convert',
  grid: 20,
  requires: ['data', 'bind', 'convert'],
  data: {
    models: {
      Root: {
        properties: Object.fromEntries(
          Object.entries(defaults).map(([n, v]) => [n, { type: 'number', default: v }]),
        ),
      },
    },
  },
  converters: defs,
  bind: bindings,
  nodes: [
    {
      id: 'dot',
      type: 'circle',
      center: [10, 10],
      r: 1,
      fill: { color: '#000' },
      properties: { label: '' },
    },
  ],
});
const player = (raw: object) => {
  const result = load(raw);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
};
describe('shared data/bind integration', () => {
  it('resolves formula paths, binding options and same-name converters from the active document', () => {
    const defs = {
      plus: { type: 'calculate', operation: 'add', operand: '$bonus' },
      square: { type: 'formula', expression: 'pow(value, 2) + $bonus' },
    };
    const a = player(
      base(defs, {
        'dot.x': { value: '$y', convert: 'plus' },
        'dot.y': { value: '$y', convert: 'square' },
      }),
    );
    const b = player(
      base(
        { plus: { type: 'calculate', operation: 'multiply', operand: 3 } },
        { 'dot.x': { value: '$y', convert: 'plus' } },
      ),
    );
    a.step(0);
    b.step(0);
    expect(a.value('dot.x')).toBe(12);
    expect(a.value('dot.y')).toBe(102);
    expect(b.value('dot.x')).toBe(30);
    a.set('$bonus', 4);
    a.step(0);
    expect(a.value('dot.x')).toBe(14);
    expect(a.value('dot.y')).toBe(104);
    const c = player(
      base(defs, { 'dot.x': { value: '$y', convert: 'plus', options: { operand: '$x' } } }),
    );
    c.step(0);
    expect(c.value('dot.x')).toBe(10);
  });
  it('registers math through the shared bind evaluator', () => {
    const p = player(base({}, { 'dot.x': 'sqrt(16) + pow(3, 2) + cos(0)' }));
    p.step(0);
    expect(p.value('dot.x')).toBe(14);
  });
  it('isolates interpolation by binding and player, retargets and settles at completion', () => {
    const raw = base(
      { smooth: { type: 'interpolate', duration: 100 } },
      { 'dot.x': { value: '$x', convert: 'smooth' }, 'dot.y': { value: '$y', convert: 'smooth' } },
    );
    const a = player(raw),
      b = player(raw);
    a.step(0);
    b.step(0);
    a.set('$x', 10);
    a.set('$y', 20);
    expect(a.step(0).settled).toBe(false);
    a.step(0.05);
    expect(a.value('dot.x')).toBe(5);
    expect(a.value('dot.y')).toBe(15);
    a.set('$x', 20);
    a.step(0);
    a.step(0.05);
    expect(a.value('dot.x')).toBe(12.5);
    expect(a.value('dot.y')).toBe(20);
    expect(a.step(0.05).settled).toBe(true);
    b.step(0.15);
    expect(b.value('dot.x')).toBe(0);
  });
  it('uses a player-seeded sequence and binding-local once caches', () => {
    const raw = base(
      { rng: { type: 'formula', expression: 'random()', random: 'once' } },
      { 'dot.x': { value: '$x', convert: 'rng' }, 'dot.y': { value: '$x', convert: 'rng' } },
    );
    const a = player(raw),
      b = player(raw);
    expect(a.step(0).settled).toBe(true);
    b.step(0);
    expect(a.value('dot.x')).toBe(0.23645552527159452);
    expect(a.value('dot.y')).toBe(0.3692706737201661);
    expect(b.value('dot.y')).toBe(a.value('dot.y'));
    a.step(1);
    expect(a.value('dot.y')).toBe(b.value('dot.y'));
  });
  it('keeps always-random awake and on-change asleep between changes', () => {
    for (const mode of ['always', 'on-change']) {
      const p = player(
        base(
          { rng: { type: 'formula', expression: 'random()', random: mode } },
          { 'dot.x': { value: '$x', convert: 'rng' } },
        ),
      );
      expect(p.step(0).settled).toBe(mode !== 'always');
      const v = p.value('dot.x');
      p.step(0);
      expect(p.value('dot.x') === v).toBe(mode !== 'always');
    }
  });
});
it('diagnoses invalid numeric operand paths before stepping', () => {
  const r = load(base({ bad: { type: 'calculate', operation: 'add', operand: '$missing' } }, {}));
  expect(r.model).toBeUndefined();
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'convert-type',
      pointer: '/converters/bad/operand',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
it('rejects a named converter absent from the current document even after another model registered it', () => {
  player(base({ old: { type: 'round' } }, { 'dot.x': { value: '$x', convert: 'old' } }));
  const r = load(base({}, { 'dot.x': { value: '$x', convert: 'old' } }));
  expect(r.model).toBeUndefined();
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'convert-reference',
      pointer: '/bind/dot.x/convert',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
it('supports direction-aware system conversion through to-source bindings', () => {
  const raw = base(
    { unit: { type: 'normalize', from: [0, 100] } },
    { 'dot.x': { value: '$x', convert: 'unit', mode: 'to-source' } },
  );
  Object.assign(raw.nodes[0]!, { x: 0.25 });
  const p = player(raw);
  p.step(0);
  expect(p.get('$x')).toBe(25);
  const r = base(
    { unit: { type: 'degrees-to-radians' } },
    { 'dot.x': { value: '$x', convert: 'unit', mode: 'to-source' } },
  );
  Object.assign(r.nodes[0]!, { x: Math.PI });
  const q = player(r);
  q.step(0);
  expect(q.get('$x')).toBe(180);
});

it('continues temporal conversion in a two-way binding while source and target are unchanged', () => {
  const raw = base(
    { smooth: { type: 'interpolate', duration: 100 } },
    { 'dot.x': { value: '$x', convert: 'smooth', mode: 'two-way' } },
  );
  const p = player(raw);
  p.step(0);
  p.set('$x', 10);
  expect(p.step(0).settled).toBe(false);
  p.step(0.05);
  expect(p.value('dot.x')).toBe(5);
  expect(p.step(0.05).settled).toBe(true);
  expect(p.value('dot.x')).toBe(10);
});
it('supports named, sequential and padded template arguments', () => {
  const p = player(
    base(
      {
        label: {
          type: 'template',
          text: '{name}: {0:2:5} {}',
          args: { name: 'Ada', 0: '$y', 1: '$bonus' },
        },
      },
      { 'dot.properties.label': { value: '$x', convert: 'label' } },
    ),
  );
  p.step(0);
  expect(p.value('dot.properties.label')).toBe('Ada: 10.00 10');
});

it('retains loaded-player dispatch and settlement after registry recomposition', () => {
  const raw = base(
    { smooth: { type: 'interpolate', duration: 100 } },
    { 'dot.x': { value: '$x', convert: 'smooth' } },
  );
  const p = player(raw);
  p.step(0);
  p.set('$x', 10);
  p.step(0);
  registerModule({ name: 'convertcheck', after: ['convert'], entries: [] });
  player(raw).step(0);
  expect(p.step(0.05).settled).toBe(false);
  expect(p.value('dot.x')).toBe(5);
  expect(p.step(0.05).settled).toBe(true);
});

it('B18: a travelling indicator eases a bound x over 200ms and retargets from its sample', () => {
  const p = player(
    base(
      { travel: { type: 'interpolate', duration: 200, ease: 'cubic(0.42, 0, 1, 1)' } },
      { 'dot.x': { value: '$x', convert: 'travel' } },
    ),
  );
  p.step(0);
  p.set('$x', 100);
  p.step(0);
  p.step(0.1);
  expect(p.value('dot.x')).toBeCloseTo(31.5357, 3);
  p.set('$x', 0);
  p.step(0);
  expect(p.value('dot.x')).toBeCloseTo(31.5357, 3);
  p.step(0.2);
  expect(p.value('dot.x')).toBe(0);
  expect(p.step(0).settled).toBe(true);
});
