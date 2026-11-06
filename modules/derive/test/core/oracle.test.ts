import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compile } from '@anima-format/markup';
import { load, Player } from '@anima-format/core';

const root = new URL('../../../../tests/oracle/', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const operators = ['lt', 'le', 'eq', 'ne', 'and', 'or', 'not'];
const names = [
  ...operators.map((op) => `bind-logic-${op}`),
  'derive-score-label',
  'derive-list-relative',
];

type Property = { path: string; value?: unknown; items?: Model[] };
type Model = { properties: Property[] };
function flatten(model: Model): Property[] {
  return model.properties.flatMap((p) => [p, ...(p.items ?? []).flatMap(flatten)]);
}

it.each(names)('retains raw native values behind the oracle projection: %s', (name) => {
  const observations = read(`${name}/rive/observations.json`) as {
    values: Record<string, unknown>;
  }[];
  observations.forEach((observation, index) => {
    const properties = flatten(read(`${name}/rive/frames/${index}.json`).viewModel);
    for (const [address, value] of Object.entries(observation.values)) {
      const path = address.startsWith('$players.')
        ? address.replace(/^\$players\.(\d+)\./, 'players[$1]/')
        : address.startsWith('$')
          ? address.slice(1)
          : address === 'dot.properties.number'
            ? 'resultNumber'
            : 'resultBool';
      const matches = properties.filter((p) => p.path === path);
      expect(matches).toHaveLength(1);
      expect(value).toEqual(matches[0]!.value);
    }
  });
});

it.each(operators)('captures both typed targets for the full truth vector: %s', (op) => {
  // Independently tabulated outcomes; includes equality boundaries, changed RHS,
  // negative fractions and all four boolean pairs, then a return to the initial values.
  const vectors: Record<string, number[]> = {
    lt: [0, 1, 0, 0, 1, 0, 1, 0, 0],
    le: [1, 1, 0, 1, 1, 1, 1, 0, 1],
    eq: [1, 0, 0, 1, 0, 1, 0, 0, 1],
    ne: [0, 1, 1, 0, 1, 0, 1, 1, 0],
    and: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    or: [0, 1, 1, 1, 0, 1, 1, 1, 0],
    not: [1, 1, 0, 0, 1, 0, 1, 0, 1],
  };
  const observations = read(`bind-logic-${op}/rive/observations.json`);
  expect(observations).toEqual(
    vectors[op]!.map((number, click) => ({
      click,
      values: { 'dot.properties.number': number, 'dot.properties.bool': Boolean(number) },
      events: [],
    })),
  );
});

it('evidences the read-only skip: native accepts a destination write; Anima rejects it', () => {
  const nativeLabel = (frame: string) =>
    read(`derive-score-label/rive/frames/${frame}.json`).viewModel.properties.find(
      (p: Property) => p.path === 'label',
    ).value;
  expect(nativeLabel('write')).toBe('manual');
  expect(nativeLabel('write-settled')).toBe('manual');
  expect(nativeLabel('source-after-write')).toBe('1,501 pts');
  const compiled = compile(readFileSync(new URL('derive-score-label/case.animl', root), 'utf8'));
  expect(compiled.diagnostics).toEqual([]);
  const { model, diagnostics } = load(compiled.doc!);
  expect(diagnostics).toEqual([]);
  const player = new Player(model!);
  player.step(0);
  expect(player.get('$label')).toBe('1,250 pts');
  expect(() => player.set('$label', 'manual')).toThrow(/read-only.*read-only-path/);
  expect(player.get('$label')).toBe('1,250 pts');
});
