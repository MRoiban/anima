import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { compile } from '../../../../packages/markup/src/index.ts';
import { load, runScript, jsonSchema } from '@anima-format/core';
it('platforms-web-canvas: both syntaxes keep core semantics and schema', () => {
  const text = readFileSync(
    new URL('../../capabilities/platforms-web-canvas/example.animl', import.meta.url),
    'utf8',
  );
  const built = compile(text);
  expect(built.diagnostics).toEqual([]);
  const doc = JSON.parse(
    readFileSync(
      new URL('../../capabilities/platforms-web-canvas/example.ani', import.meta.url),
      'utf8',
    ),
  );
  expect(built.doc).toEqual(doc);
  const result = load(doc);
  expect(result.diagnostics).toEqual([]);
  expect(runScript(result.model!, 'advance 0\nsnapshot').snapshots).toEqual([
    { time: 0, values: {}, states: {}, events: [], settled: true },
  ]);
  expect(JSON.stringify(jsonSchema())).not.toContain('pixel-ratio');
});
