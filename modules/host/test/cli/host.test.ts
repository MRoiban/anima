import { it, expect } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('host example validates, inspects and samples in both spellings', async () => {
  for (const ext of ['ani', 'animl']) {
    const file = new URL('../../examples/score.' + ext, import.meta.url).pathname;
    const validation = await cli('validate', file);
    expect(validation.code, validation.err).toBe(0);
    const inspection = await cli('inspect', file, '--format=json');
    expect(inspection.code, inspection.err).toBe(0);
    expect(JSON.parse(inspection.out).inputs).toMatchObject({
      '$main:score': 'number',
      '$main:label': 'string',
    });
    const sample = await cli(
      'sample',
      file,
      '-e',
      'set $score 8\nadvance 0\nsnapshot $score $label',
    );
    expect(sample.code, sample.err).toBe(0);
    expect(JSON.parse(sample.out).values).toEqual({ $score: 8, $label: 'Ada' });
  }
});
it('generated CLI docs include the module-owned host specification', async () => {
  const result = await cli('docs', 'host');
  expect(result.code, result.err).toBe(0);
  expect(result.out).toContain('Host data API');
  expect(result.out).toContain('auto-bind');
});
