// Issue #29: transition guards use `!name` and `&&`; `not` and `or` are bind-expression syntax.
// An author moving between the two gets a hint that names the difference.
import { expect, it } from 'vitest';
import '../src/all.ts';
import { load } from '../src/index.ts';

const doc = (when: string) => ({
  anima: '0.1',
  name: 'guards',
  grid: 20,
  inputs: { on: { type: 'bool' }, hover: { type: 'bool' } },
  nodes: [{ id: 'r', type: 'rect', x0: 0, y0: 0, w: 2, h: 2, fill: { color: '#000' } }],
  machine: {
    layers: {
      l: { initial: 'off', states: { off: { on: [{ when, to: 'lit' }] }, lit: {} } },
    },
  },
});
const hints = (when: string) =>
  load(doc(when))
    .diagnostics.filter((d) => d.code === 'bad-condition')
    .map((d) => d.hint);

it('points not/or guards at the guard grammar', () => {
  expect(hints('not on')[0]).toMatch(/"not" and "or" are bind-expression syntax: write !name/);
  expect(hints('on or hover')[0]).toMatch(/one transition per "or" branch/);
});

it('keeps the grammar hint for other unreadable guards, and accepts !name', () => {
  expect(hints('on ~ hover')[0]).toBe(
    'terms: name, !name, name OP number, @end, @after(s), joined with &&',
  );
  expect(hints('!on && hover')).toEqual([]);
  expect(hints('nothing')).toEqual([]); // `not` only as a whole word
});
