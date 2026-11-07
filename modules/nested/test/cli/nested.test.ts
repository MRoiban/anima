import { it, expect } from 'vitest';
import { run } from '../../../../packages/cli/src/cli.ts';
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('documents optional nested controls and library metadata; exposes registry spellings', async () => {
  for (const topic of ['nested', 'markup-libraries']) {
    const r = await cli('docs', topic);
    expect(r.code, r.err).toBe(0);
    expect(r.out).toContain(topic === 'nested' ? 'fps' : 'exports');
  }
  const s = await cli('schema', 'instance');
  for (const name of ['time', 'fps', 'fit', 'align', 'size']) expect(s.out).toContain(name);
});
it('validates, inspects and samples the compiled example in both spellings', async () => {
  for (const ext of ['animl', 'ani']) {
    const file = 'modules/nested/examples/controls.' + ext;
    expect((await cli('validate', file)).code).toBe(0);
    const i = await cli('inspect', file, '--format=json');
    expect(i.code, i.err).toBe(0);
    expect(i.out).toContain('clocked');
    const r = await cli(
      'sample',
      file,
      '-e',
      'advance 0\nsnapshot clocked/dot.r clocked/outputs.done',
    );
    expect(r.code, r.err).toBe(0);
    expect(JSON.parse(r.out).values).toEqual({
      'clocked/dot.r': 2.5,
      'clocked/outputs.done': true,
    });
  }
});
