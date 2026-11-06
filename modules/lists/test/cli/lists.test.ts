import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('schema/docs/inspect/sample expose lists in both source forms', async () => {
  const schema = await cli('schema', 'repeat');
  expect(schema.code, schema.err).toBe(0);
  for (const key of ['list', 'count', 'component', 'dx', 'dy', 'size'])
    expect(schema.out).toContain(key);
  const docs = await cli('docs', 'lists');
  expect(docs.code, docs.err).toBe(0);
  expect(docs.out).toContain('reserved-name');
  for (const ext of ['ani', 'animl']) {
    const path = new URL('../../examples/players.' + ext, import.meta.url).pathname;
    const inspect = await cli('inspect', path, '--format=json');
    expect(inspect.code, inspect.err).toBe(0);
    const sample = await cli('sample', path, '-e', 'advance 0; snapshot rows/0/dot.r rows/1/dot.x');
    expect(sample.code, sample.err).toBe(0);
    expect(JSON.parse(sample.out).values).toEqual({ 'rows/0/dot.r': 3, 'rows/1/dot.x': 1 });
  }
});
