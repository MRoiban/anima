import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('validates, inspects and samples computed paths in AniML and JSON', async () => {
  for (const ext of ['ani', 'animl']) {
    const path = new URL('../../examples/scoreboard.' + ext, import.meta.url).pathname;
    const valid = await cli('validate', path);
    expect(valid.code, valid.err).toBe(0);
    const inspected = await cli('inspect', path, '--format=json');
    expect(inspected.code, inspected.err).toBe(0);
    expect(JSON.parse(inspected.out).inputs).toMatchObject({
      '$main:players.0.label': 'string',
      '$main:players.0.milestone': 'bool',
    });
    const sample = await cli(
      'sample',
      path,
      '-e',
      'set $players.0.score 1500; advance 0; snapshot $players.0.label $players.0.milestone a.x b.x c.x',
    );
    expect(sample.code, sample.err).toBe(0);
    expect(JSON.parse(sample.out).values).toEqual({
      '$players.0.label': '1,500 pts',
      '$players.0.milestone': true,
      'a.x': 1,
      'b.x': 0,
      'c.x': 0,
    });
  }
});
it('exposes computed registry spellings through schema and docs', async () => {
  const schema = await cli('schema', 'data');
  expect(schema.code, schema.err).toBe(0);
  expect(schema.out).toContain('models');
  const full = await cli('schema', '--json-schema');
  const properties = JSON.parse(full.out).properties.data.properties.models.additionalProperties
    .properties.properties.additionalProperties.properties;
  expect(properties.value).toMatchObject({ type: 'string' });
  expect(properties.convert).toMatchObject({ type: 'string' });
  const docs = await cli('docs', 'derive');
  expect(docs.code, docs.err).toBe(0);
  expect(docs.out).toContain('read-only-path');
  expect(docs.out).toContain('modules/derive/examples/scoreboard.animl');
});
