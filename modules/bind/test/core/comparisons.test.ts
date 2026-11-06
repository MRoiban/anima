import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { expression, evaluate } from '../../core/expression.ts';
const types = new Map([
  ['a', 'number'],
  ['b', 'number'],
  ['yes', 'bool'],
  ['no', 'bool'],
  ['label', 'string'],
]);
const scope = new Map<string, number | boolean | string>([
  ['a', 3],
  ['b', 2],
  ['yes', true],
  ['no', false],
  ['label', 'Ada'],
]);
it.each([
  ['a > b', true],
  ['a >= 3', true],
  ['b < a', true],
  ['b <= 1', false],
  ['a == 3', true],
  ['a != 3', false],
  ['label == "Ada"', true],
  ['label != "Lin"', true],
  ['yes == no', false],
  ['not a < b', true],
  ['not yes or no', false],
  ['yes or no and no', true],
  ['(yes or no) and no', false],
  ['a + b * 3 >= 9 and not no', true],
  ['yes and a > b or no', true],
])('%s → %s', (source, expected) =>
  expect(evaluate(expression(source, types), scope)).toBe(expected),
);
it.each(['a and yes', 'not a', 'label < "Lin"', 'a == yes', 'yes > no'])(
  'rejects type mismatch %s',
  (source) =>
    expect(() => expression(source, types)).toThrowError(
      expect.objectContaining({ code: 'bind-type' }),
    ),
);
it('short-circuits logical evaluation', () => {
  const reads: string[] = [];
  const input = {
    get: (n: string) => {
      reads.push(n);
      return scope.get(n);
    },
  } as ReadonlyMap<string, number | boolean | string>;
  evaluate(expression('yes or no', types), input);
  expect(reads).toEqual(['yes']);
});
it('reports unsupported token and allowed grammar with a pointer', () => {
  const r = load({
    anima: '0.1',
    name: 'bad-expression',
    grid: 20,
    requires: ['bind'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    bind: { 'dot.x': '1 % 2' },
  });
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'bind-syntax',
      pointer: '/bind/dot.x',
      message: expect.stringContaining('%'),
      hint: expect.stringContaining('comparisons'),
    }),
  );
});
it('shares typed precedence between scalar guards, bindings and set actions', () => {
  const raw = {
    anima: '0.1',
    name: 'comparison',
    grid: 20,
    requires: ['bind'],
    inputs: { n: { type: 'number' }, flag: { type: 'bool' } },
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    bind: { 'dot.x': 'n >= 2 and not flag' },
    listeners: [{ on: 'click', set: { flag: 'n == 2 or n > 5' } }],
    machine: {
      layers: {
        m: {
          initial: 'idle',
          states: {
            idle: { pose: {}, on: [{ to: 'done', when: 'n >= 2 && (not flag or n > 5)' }] },
            done: { pose: {} },
          },
        },
      },
    },
  };
  const r = load(raw);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.set('n', 2);
  p.step(0);
  expect(p.value('dot.x')).toBe(1);
  expect(p.inspect()[0]?.state).toBe('done');
  p.act(p.model.listeners[0]!);
  p.step(0);
  expect(p.get('flag')).toBe(true);
  expect(p.value('dot.x')).toBe(0);
});
