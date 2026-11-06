import '@anima-format/core/all';
import { describe, expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import {
  convertValue as cv,
  createConverterRunner,
  formula,
  mathFunctions,
  registerMathFunctions,
  validateDefinition,
} from '../../core/index.ts';
import type { ConverterValue as Val, ConverterOptions as Opt } from '../../core/index.ts';
const ctx = () => ({ player: {}, time: 0, seed: 1, key: 'test' });
const table: [string, Val, Opt, Val][] = [
  ['range', 0.25, { from: [0, 1], to: [0, 100] }, 25],
  ['range', -1, { clamp: true }, 0],
  ['range', 2, { clamp: true }, 1],
  ['range', -0.25, { modulo: true }, 0.75],
  ['range', 1.25, { modulo: true }, 0.25],
  ['range', 0.25, { reverse: true }, 0.75],
  ['range', 0.25, { from: [1, 0], to: [0, 100] }, 75],
  ['round', 1.235, { decimals: 2 }, 1.24],
  ['round', 1.239, { decimals: 2, mode: 'floor' }, 1.23],
  ['round', 1.231, { decimals: 2, mode: 'ceil' }, 1.24],
  ['negate', false, {}, true],
  ['negate', true, {}, false],
  ['to-number', '12.5', {}, 12.5],
  ['to-number', 'bad', {}, 0],
  ['to-number', true, {}, 1],
  ['to-string', false, {}, 'false'],
  ['to-string', 12.5, {}, '12.5'],
  ['number-format', 1234.5, { decimals: 2, grouping: true }, '1,234.50'],
  ['number-format', -1234.5, { decimals: 2, grouping: true }, '-1,234.50'],
  ['color-format', '#f00', {}, '#ff0000'],
  ['color-format', '#00000080', { format: 'hexa' }, '#00000080'],
  ['color-format', '#f00', { format: 'rgb' }, 'rgb(255, 0, 0)'],
  ['color-format', '#f00', { format: 'rgba' }, 'rgba(255, 0, 0, 1)'],
  ['pad', '7', { length: 3, fill: '0' }, '007'],
  ['pad', 'a', { length: 4, side: 'end', fill: 'xy' }, 'axyx'],
  ['pad', 'long', { length: 2 }, 'long'],
  ['trim', '  x  ', { mode: 'all' }, 'x'],
  ['trim', '  x  ', { mode: 'start' }, 'x  '],
  ['trim', '  x  ', { mode: 'end' }, '  x'],
  ['trim', '  x  ', { mode: 'none' }, '  x  '],
  ['template', 12, { text: '{0} pts' }, '12 pts'],
  ['template', ['Ada', 12.5], { text: '{0}: {1:2}' }, 'Ada: 12.50'],
  ['template', [1234.5], { text: '[[0:2]]', open: '[[', close: ']]', grouping: true }, '1,234.50'],
  ['remove-zeros', '12.3400', {}, '12.34'],
  ['remove-zeros', '12.000', {}, '12'],
  ['remove-zeros', '100', {}, '100'],
  ['remove-zeros', '0.000', {}, '0'],
  ['enum-to-index', 'happy', { values: ['calm', 'happy'] }, 1],
  ['list-length', ['a', 'b'], {}, 2],
  ['number-to-list', 3, {}, [0, 1, 2]],
  ['number-to-list', 2, { item: 'a' }, ['a', 'a']],
  ['trigger', true, {}, true],
  ['degrees-to-radians', 180, {}, Math.PI],
  ['normalize', 25, { from: [0, 100] }, 0.25],
  ['calculate', 4, { operation: 'add', operand: 3 }, 7],
  ['calculate', 4, { operation: 'subtract', operand: 3 }, 1],
  ['calculate', 4, { operation: 'multiply', operand: 3 }, 12],
  ['calculate', 4, { operation: 'divide', operand: 2 }, 2],
  ['calculate', 4, { operation: 'divide', operand: 0 }, 0],
  ['calculate', -1, { operation: 'modulo', operand: 4 }, 3],
  ['formula', 3, { expression: 'pow(value, 2) + sqrt(16)' }, 13],
  ['formula', 1, { expression: 'sin(0) + cos(0) + abs(-2)' }, 3],
  ['formula', 1, { expression: 'atan2(0, -1)' }, Math.PI],
  ['formula', 1, { expression: 'min(round(2.4), ceil(1.1)) + floor(2.9)' }, 4],
  ['formula', 1, { expression: 'sqrt(-1)' }, 0],
];
describe('independent converter input/output conformance tables', () => {
  it.each(table)('%s(%j, %j)', (type, value, options, expected) =>
    expect(cv(type, value, options, ctx())).toEqual(expected),
  );
  it.each([...mathFunctions.keys()])('math function %s', (name) => {
    const input = name.includes('acos') || name === 'log' ? 1 : 0;
    const expected = name === 'cos' || name === 'cosine' || name === 'exp' ? 1 : 0;
    expect(cv('calculate', input, { operation: name, operand: 1 }, ctx())).toBe(expected);
  });
  it('exports the registration adapter without importing data', () => {
    const registered = new Map();
    registerMathFunctions((n, f) => registered.set(n, f));
    expect([...registered.keys()]).toEqual([...mathFunctions.keys()]);
  });
  it('retains bind precedence and supports additional input values', () => {
    const run = formula(
      'sin(n) + value * 2',
      new Map([
        ['n', 'number'],
        ['value', 'number'],
      ]),
    );
    expect(
      run(
        new Map([
          ['n', 0],
          ['value', 3],
        ]),
        ctx(),
        'always',
        3,
      ),
    ).toBe(6);
  });
  it('nested calls keep separate random sites', () => {
    const c = ctx();
    expect(cv('formula', 0, { expression: 'random() + random()', random: 'once' }, c)).toBe(
      0.6057261989917606,
    );
  });
});
describe('player-owned temporal conformance', () => {
  it('matches an independently calculated LCG sequence and isolates players', () => {
    const a = ctx(),
      b = ctx();
    const options = { expression: 'random()' };
    expect([
      cv('formula', 0, options, a),
      cv('formula', 0, options, a),
      cv('formula', 0, options, a),
    ]).toEqual([0.23645552527159452, 0.3692706737201661, 0.5042420323006809]);
    expect(cv('formula', 0, options, b)).toBe(0.23645552527159452);
  });
  it('once and on-change resampling policies', () => {
    for (const mode of ['once', 'on-change']) {
      const c = ctx(),
        o = { expression: 'random()', random: mode };
      expect(cv('formula', 1, o, c)).toBe(0.23645552527159452);
      expect(cv('formula', 1, o, c)).toBe(0.23645552527159452);
      expect(cv('formula', 2, o, c)).toBe(
        mode === 'once' ? 0.23645552527159452 : 0.3692706737201661,
      );
    }
  });
  it('interpolates numbers in milliseconds, retargets from the current sample, isolates players', () => {
    const c = ctx(),
      o = { duration: 100 };
    expect(cv('interpolate', 0, o, c)).toBe(0);
    expect(cv('interpolate', 10, o, c)).toBe(0);
    c.time = 50;
    expect(cv('interpolate', 10, o, c)).toBe(5);
    expect(cv('interpolate', 20, o, c)).toBe(5);
    c.time = 100;
    expect(cv('interpolate', 20, o, c)).toBe(12.5);
    c.time = 150;
    expect(cv('interpolate', 20, o, c)).toBe(20);
    expect(cv('interpolate', 99, o, ctx())).toBe(99);
  });
  it('interpolates colour channels and alpha', () => {
    const c = ctx(),
      o = { duration: 100 };
    expect(cv('interpolate', '#00000000', o, c)).toEqual([0, 0, 0, 0]);
    cv('interpolate', '#ffffff', o, c);
    c.time = 50;
    expect(cv('interpolate', '#ffffff', o, c)).toEqual([128, 128, 128, 128]);
  });
  it('groups apply in order and duplicate uses have separate temporal state', () => {
    const run = createConverterRunner({
      pct: { type: 'range', to: [0, 100] },
      round: { type: 'round' },
      label: { type: 'template', text: '{0} pts' },
      fmt: { chain: ['pct', 'round', 'label'] },
    });
    expect(run('fmt', 0.126, ctx())).toBe('13 pts');
  });
});
const doc = (converters: object) => ({
  anima: '0.1',
  name: 'convert',
  grid: 20,
  requires: ['convert'],
  converters,
  nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
});
describe('converter diagnostics', () => {
  it.each([
    [{ x: { type: 'missing' } }, 'convert-unknown-type', '/converters/x/type'],
    [{ x: { type: 'range', from: [1, 1] } }, 'convert-options', '/converters/x/from'],
    [{ x: { type: 'range', text: 'x' } }, 'convert-options', '/converters/x/text'],
    [{ x: { type: 'calculate', operation: 'nope' } }, 'convert-options', '/converters/x/operation'],
    [{ x: { type: 'round', mode: 'nope' } }, 'convert-options', '/converters/x/mode'],
    [{ x: { type: 'formula', expression: 'sin()' } }, 'bind-syntax', '/converters/x'],
    [{ x: { chain: ['x'] } }, 'convert-cycle', '/converters/x/chain'],
    [{ x: { chain: ['y'] }, y: { chain: ['x'] } }, 'convert-cycle', '/converters/x/chain'],
    [{ x: { chain: ['missing'] } }, 'convert-reference', '/converters/x/chain'],
  ] as const)('%j', (defs, code, pointer) => {
    const result = load(doc(defs));
    expect(result.model).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer,
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
  it.each(['range', 'round', 'normalize', 'degrees-to-radians', 'interpolate'])(
    '%s rejects string input',
    (type) => expect(() => cv(type, 'bad', {}, ctx())).toThrow('expected'),
  );
  it.each(['pad', 'trim', 'remove-zeros'])('%s rejects number input', (type) =>
    expect(() => cv(type, 1, {}, ctx())).toThrow('expected string'),
  );
  it('rejects mismatched interpolation types', () => {
    const c = ctx();
    cv('interpolate', 1, { duration: 100 }, c);
    expect(() => cv('interpolate', '#fff', { duration: 100 }, c)).toThrow(
      'same interpolation type',
    );
  });
  it('valid declarations are loadable by core with schema support', () => {
    const result = load(
      doc({
        pct: { type: 'range', to: [0, 100] },
        label: { type: 'template', text: '{0}' },
        fmt: { chain: ['pct', 'label'] },
      }),
    );
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.model).toBeDefined();
  });
  it.each([
    'random() +',
    'pow(1)',
    'random(1)',
    'sin(missing)',
    'sin('.repeat(66) + '1' + ')'.repeat(66),
  ])('rejects malformed formulas: %s', (expression) =>
    expect(() => validateDefinition({ type: 'formula', expression })).toThrow(),
  );
  it('plain input bindings continue to work alongside converter declarations', () => {
    const result = load({
      ...doc({ pct: { type: 'range' } }),
      requires: ['bind', 'convert'],
      inputs: { n: { type: 'number', default: 2 } },
      bind: { 'dot.x': 'n * 3' },
    });
    const player = new Player(result.model!);
    player.step(0);
    expect(player.values()['dot.x']).toBe(6);
  });
});
