// Issue #50: clearer diagnostics for $parent in models, inherited converters, duplicates and cascades.
import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { compile } from '@anima-format/markup';
import { listState } from '../../core/index.ts';

const source = readFileSync(
  new URL('../../../../design/issues/proof/50-diagnostics.animl', import.meta.url),
  'utf8',
);

it('reports $parent in a model computed value once, with a specific message and no cascade', () => {
  const errors = compile(source).diagnostics.filter((d) => d.severity === 'error');
  expect(errors).toHaveLength(1);
  expect(errors[0]).toMatchObject({
    code: 'unknown-input',
    pointer: '/data/models/Item/properties/up/value',
  });
  expect(errors[0]!.message).toContain('cannot read $parent.view');
  expect(errors[0]!.hint).toContain('component binds');
});

it('lets a repeated component use the document converters of its inherited models', () => {
  const built = compile(source.replace('    <number name="up" value="$parent.view"/>\n', ''));
  expect(built.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(load(built.doc!).model!) as Player & {
    data: { list(path: string): { set(value: unknown): void } };
  };
  p.step(0);
  p.data.list('$main:items').set([{ x: 4 }]);
  p.step(0);
  p.step(1);
  const row = listState(p)!.runs[0]!.items[0]!.player.values();
  expect(row['dot.x']).toBe(4);
});

it('still reports a component map that has no entry for the list model', () => {
  const errors = compile(
    source
      .replace('    <number name="up" value="$parent.view"/>\n', '')
      .replace('component="row"', 'component="Board:row"'),
  ).diagnostics.filter((d) => d.severity === 'error');
  expect(errors.map((d) => d.code)).toContain('list-map');
});
