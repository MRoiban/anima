import { it, expect } from 'vitest';
import { run } from '../../../../packages/cli/src/cli.ts';
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('CLI validates, inspects and samples live data keys and typed component guards in both spellings', async () => {
  for (const [base, address, want] of [
    ['modules/motion/examples/data-keys', 'probe.r', 2],
    ['modules/nested/examples/component-guard', 'probe.r', 9],
  ] as const)
    for (const ext of ['animl', 'ani']) {
      const file = base + '.' + ext;
      const v = await cli('validate', file);
      expect(v.code, v.err).toBe(0);
      const i = await cli('inspect', file, '--format=json');
      expect(i.code, i.err).toBe(0);
      expect(i.out).toContain('probe');
      const s = await cli('sample', file, '-e', 'advance 0.25\nsnapshot ' + address);
      expect(s.code, s.err).toBe(0);
      expect(JSON.parse(s.out).values[address]).toBe(want);
    }
});
