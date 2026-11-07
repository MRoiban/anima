import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { load, Player } from '@anima-format/core';
import { compile } from '@anima-format/markup';
it('unions translated painted descendants, preserves explicit boxes and falls back to a point', () => {
  const source = readFileSync(
    new URL('../../examples/painted-groups.animl', import.meta.url),
    'utf8',
  );
  const result = compile(source);
  expect(result.diagnostics).toEqual([]);
  const p = new Player(load(result.doc!).model!);
  expect(p.semantics().map((n) => n.bounds)).toEqual([
    [6, 23, 10, 5],
    [40, 0, 1, 1],
    [50, 60, 0, 0],
  ]);
});
it('rejects negative semantic bounds at the same pointer in both spellings', () => {
  const json = load({
    anima: '0.1',
    name: 'bad-bounds',
    grid: 20,
    requires: ['a11y'],
    nodes: [{ id: 'n', type: 'group', a11y: { role: 'group', bounds: [0, 0, -1, 1] } }],
  });
  const markup = compile(
    '<anima version="0.1" name="bad-bounds" grid="20" requires="a11y"><group id="n"><a11y role="group" bounds="0 0 -1 1"/></group></anima>',
  );
  for (const result of [json, markup])
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'bad-value',
        pointer: '/nodes/0/a11y/bounds/2',
        message: expect.stringMatching(/.+/),
      }),
    );
});
