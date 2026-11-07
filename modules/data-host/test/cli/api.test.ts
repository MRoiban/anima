import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('nested host model vocabulary validates, inspects, samples and round-trips through CLI', async () => {
  for (const ext of ['ani', 'animl']) {
    const file = new URL('../../examples/nested.' + ext, import.meta.url).pathname;
    expect(await cli('validate', file)).toMatchObject({ code: 0 });
    const inspection = await cli('inspect', file, '--format=json');
    expect(inspection.code, inspection.err).toBe(0);
    expect(JSON.parse(inspection.out).inputs['$team.lead.name']).toBe('string');
    const sampled = await cli(
      'sample',
      file,
      '-e',
      'set $a 7\nset $team.lead.name "Grace"\nadvance 0\nsnapshot dot.r $team.lead.name',
    );
    expect(sampled.code, sampled.err).toBe(0);
    expect(JSON.parse(sampled.out).values).toEqual({ 'dot.r': 7, '$team.lead.name': 'Grace' });
  }
  const docs = await cli('docs', 'data-host');
  expect(docs.code, docs.err).toBe(0);
  expect(docs.out).toContain('player.computed');
});
it('the CLI samples validated asset literals and generated image asset binding schema', async () => {
  const file = new URL(
    '../../../../spec/conformance/data-host-asset-literal/case.animl',
    import.meta.url,
  ).pathname;
  expect(await cli('validate', file)).toMatchObject({ code: 0 });
  const sample = await cli('sample', file, '-e', 'advance 0\nsnapshot dot.r');
  expect(sample.code, sample.err).toBe(0);
  expect(JSON.parse(sample.out).values).toEqual({ 'dot.r': 1 });
});
