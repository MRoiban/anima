import '../../../../packages/core/src/all.ts';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { load, runScript } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
const root = new URL('../../../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const rows = JSON.parse(read('modules/input/rows.json')) as { row: string }[];
const schema = new Ajv2020({ strict: true, strictTuples: false, allErrors: true })
  .addKeyword('feature')
  .compile(JSON.parse(read('spec/schema/ani.schema.json')));
it('retains all 54 requested rows exactly once', () => {
  expect(rows).toHaveLength(54);
  expect(new Set(rows.map((r) => r.row)).size).toBe(54);
});
for (const { row } of rows) {
  const slug = row.replace('.', '-'),
    base = `modules/input/capabilities/${slug}`;
  it(`${row}: paired example, schema, registry spellings, CLI command script and diagnostic`, () => {
    const example = JSON.parse(read(base + '/example.ani'));
    const c = compile(read(base + '/example.animl'));
    expect(c.diagnostics).toEqual([]);
    expect(c.doc).toEqual(example);
    expect(compile(decompile(example)).doc).toEqual(example);
    expect(schema(example), JSON.stringify(schema.errors)).toBe(true);
    const loaded = load(example);
    expect(loaded.diagnostics).toEqual([]);
    const snapshots = runScript(
      loaded.model!,
      read(`spec/conformance/${slug}/script.txt`),
    ).snapshots;
    const expected = read(`spec/conformance/${slug}/expected.jsonl`)
      .trim()
      .split('\n')
      .map((s) => JSON.parse(s));
    expect(snapshots).toEqual(expected);
    if (!row.startsWith('input.pointer-drag')) {
      const invalid = JSON.parse(read(base + '/invalid.json'));
      expect(load(invalid.document).diagnostics).toContainEqual(
        expect.objectContaining({
          code: invalid.code,
          pointer: invalid.pointer,
          message: expect.any(String),
        }),
      );
      expect(load(invalid.document).model).toBeUndefined();
    }
  });
}

it('propagate is a registry boolean shared by AniML, JSON schema and decompilation', () => {
  const source = `<anima version="0.1" name="propagate" grid="20" requires="input"><number name="n"/><circle id="disc" cx="10" cy="10" r="5" fill="#000"/><listener on="key-down" target="disc" set="n=1" propagate="true"/></anima>`;
  const c = compile(source);
  expect(c.diagnostics).toEqual([]);
  expect(schema(c.doc)).toBe(true);
  expect(compile(decompile(c.doc!)).doc).toEqual(c.doc);
  expect((c.doc!.listeners as { propagate: boolean }[])[0]!.propagate).toBe(true);
  const invalid = structuredClone(c.doc!);
  (invalid.listeners as { propagate: unknown }[])[0]!.propagate = 'yes';
  expect(schema(invalid)).toBe(false);
  expect(load(invalid).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'type',
      pointer: '/listeners/0/propagate',
      message: 'expected boolean, got string',
    }),
  );
});
