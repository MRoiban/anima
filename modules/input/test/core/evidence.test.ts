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
