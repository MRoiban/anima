import { it, expect } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('validates, inspects, samples and documents data extras in both spellings', async () => {
  for (const ext of ['ani', 'animl']) {
    const file = new URL('../../examples/data-extras.' + ext, import.meta.url).pathname;
    expect((await cli('validate', file)).code).toBe(0);
    const r = await cli(
      'sample',
      file,
      '-e',
      'advance 0; set $mood "happy"; set $ready true; advance 0; set $level 1; advance 0; advance 0; snapshot dot.r dot.properties.label',
    );
    expect(r.code, r.err).toBe(0);
    expect(JSON.parse(r.out).values).toEqual({ 'dot.r': 5, 'dot.properties.label': '15 63% 60%' });
    const inspect = await cli('inspect', file, '--format=json');
    expect(inspect.code, inspect.err).toBe(0);
    expect(inspect.out).toContain('$levelUp');
  }
  const schema = await cli('schema', '--json-schema');
  const properties = JSON.parse(schema.out).properties;
  expect(properties.converters.additionalProperties.properties.pattern.type).toBe('string');
  expect(properties.data.properties.instances.additionalProperties.properties.exported.type).toBe(
    'boolean',
  );
  for (const [topic, text] of [
    ['data', 'exports()'],
    ['convert', 'Colour component patterns'],
  ] as const) {
    const docs = await cli('docs', topic);
    expect(docs.code).toBe(0);
    expect(docs.out).toContain(text);
  }
});
