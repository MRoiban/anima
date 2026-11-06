import { it, expect } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('validates, inspects and samples named converter groups in both spellings', async () => {
  for (const ext of ['ani', 'animl']) {
    const file = new URL('../../examples/score.' + ext, import.meta.url).pathname;
    const valid = await cli('validate', file);
    expect(valid.code, valid.err).toBe(0);
    const sample = await cli(
      'sample',
      file,
      '-e',
      'advance 0\nsnapshot dot.x dot.properties.label',
    );
    expect(sample.code, sample.err).toBe(0);
    expect(JSON.parse(sample.out).values).toEqual({
      'dot.x': 12.6,
      'dot.properties.label': '13 pts',
    });
    const inspect = await cli('inspect', file, '--format=json');
    expect(inspect.code, inspect.err).toBe(0);
    expect(JSON.parse(inspect.out).bound).toEqual(['dot.x', 'dot.properties.label']);
  }
});
it('exposes converter declarations, live operands and math hooks in schema/docs', async () => {
  const schema = await cli('schema', '--json-schema');
  expect(schema.code, schema.err).toBe(0);
  expect(
    JSON.parse(schema.out).properties.converters.additionalProperties.properties,
  ).toHaveProperty('chain');
  const markup = await cli('schema', 'converter');
  expect(markup.code, markup.err).toBe(0);
  expect(markup.out).toContain('expression');
  const docs = await cli('docs', 'convert');
  expect(docs.code, docs.err).toBe(0);
  expect(docs.out).toContain('registerConverter');
  expect(docs.out).toContain('registerFunction');
});
