import { it, expect } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('host-edit example validates, inspects and samples through CLI in both spellings', async () => {
  for (const ext of ['ani', 'animl']) {
    const file = new URL('../../examples/board.' + ext, import.meta.url).pathname;
    const validation = await cli('validate', file);
    expect(validation.code, validation.err).toBe(0);
    const inspection = await cli('inspect', file, '--format=json');
    expect(inspection.code, inspection.err).toBe(0);
    expect(JSON.parse(inspection.out).inputs).toMatchObject({
      '$main:score': 'number',
      '$main:mood': 'string',
    });
    const sample = await cli(
      'sample',
      file,
      '-e',
      'set $score 8\nadvance 0\nsnapshot $score $mood $tracks.length',
    );
    expect(sample.code, sample.err).toBe(0);
    expect(JSON.parse(sample.out).values).toEqual({
      $score: 8,
      $mood: 'calm',
      '$tracks.length': 2,
    });
  }
});
