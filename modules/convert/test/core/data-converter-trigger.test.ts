import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import { load, runScript } from '../../../../packages/core/src/index.ts';
it('data-converter-trigger: both spellings and independent conformance expectations', () => {
  const dir = new URL('../../../../spec/conformance/data-converter-trigger/', import.meta.url);
  const compiled = compile(readFileSync(new URL('case.animl', dir), 'utf8'));
  expect(compiled.diagnostics).toEqual([]);
  const expected = readFileSync(new URL('expected.jsonl', dir), 'utf8')
    .trim()
    .split('\n')
    .map((s) => JSON.parse(s));
  for (const raw of [compiled.doc!, compile(decompile(compiled.doc!)).doc!])
    expect(
      runScript(load(raw).model!, readFileSync(new URL('script.txt', dir), 'utf8')).snapshots,
    ).toEqual(expected);
});
