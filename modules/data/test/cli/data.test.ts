import { it, expect } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('validates and samples authored data models in both public syntaxes', async () => {
  for (const ext of ['ani', 'animl']) {
    const path = new URL('../../examples/scoreboard.' + ext, import.meta.url).pathname;
    const result = await cli('validate', path);
    expect(result.code, result.err).toBe(0);
    const sample = await cli('sample', path, '-e', 'advance 0\nsnapshot $score $label');
    expect(sample.code, sample.err).toBe(0);
    expect(JSON.parse(sample.out).values).toEqual({ $score: 8, $label: 'Ada' });
  }
});
it('exposes all model property types and binding modes through JSON Schema', async () => {
  const r = await cli('schema', '--json-schema');
  expect(r.code).toBe(0);
  const schema = JSON.parse(r.out);
  const data = schema.properties.data;
  expect(
    data.properties.models.additionalProperties.properties.properties.additionalProperties
      .properties.type.enum,
  ).toEqual([
    'number',
    'string',
    'bool',
    'color',
    'trigger',
    'enum',
    'list',
    'model-ref',
    'asset-ref',
  ]);
  expect(JSON.stringify(schema.properties.bind)).toContain('two-way');
});
it('documents the data contract and inspects typed data paths in both spellings', async () => {
  const docs = await cli('docs', 'data');
  expect(docs.code, docs.err).toBe(0);
  expect(docs.out).toContain('two-way');
  expect(docs.out).toContain('change:$path');
  for (const ext of ['ani', 'animl']) {
    const path = new URL('../../examples/scoreboard.' + ext, import.meta.url).pathname;
    const result = await cli('inspect', path, '--format=json');
    expect(result.code, result.err).toBe(0);
    const summary = JSON.parse(result.out);
    expect(summary.inputs).toMatchObject({ '$main:score': 'number', '$main:label': 'string' });
  }
});
