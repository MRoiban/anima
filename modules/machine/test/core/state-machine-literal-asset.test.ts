import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import { load, runScript } from '../../../../packages/core/src/index.ts';
it('state-machine.literal-asset: both spellings and independent deterministic vectors', () => {
  const dir = new URL('../../../../spec/conformance/state-machine-literal-asset/', import.meta.url);
  const r = compile(readFileSync(new URL('case.animl', dir), 'utf8'));
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(r.doc).toBeDefined();
  const expected = readFileSync(new URL('expected.jsonl', dir), 'utf8')
    .trim()
    .split('\n')
    .map((s) => JSON.parse(s));
  for (const raw of [r.doc!, compile(decompile(r.doc!)).doc!]) {
    const loaded = load(raw);
    expect(loaded.model).toBeDefined();
    expect(
      runScript(loaded.model!, readFileSync(new URL('script.txt', dir), 'utf8')).snapshots,
    ).toEqual(expected);
  }
});

it('rejects a bad typed guard with code, pointer, message and hint', () => {
  const raw = JSON.parse(
    readFileSync(
      new URL('./invalid/state-machine-literal-asset/type.ani', import.meta.url),
      'utf8',
    ),
  );
  const r = load(raw);
  expect(r.model).toBeUndefined();
  const d = r.diagnostics.find((d) => d.code === 'data-guard')!;
  expect(d.pointer).toBe('/machine/layers/status/states/idle/on/0/when');
  expect(d.message.length).toBeGreaterThan(0);
  expect(d.hint!.length).toBeGreaterThan(0);
});
