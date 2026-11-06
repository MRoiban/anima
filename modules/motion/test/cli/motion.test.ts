import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
const root = new URL('../../../../', import.meta.url);
const cli = async (...args: string[]) => {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
};
it('validates, inspects and formats both motion example spellings', async () => {
  for (const ext of ['ani', 'animl']) {
    const file = new URL('examples/motion.' + ext, root).pathname;
    expect((await cli('validate', file)).code).toBe(0);
    const r = await cli('inspect', file, '--format=json');
    expect(r.code).toBe(0);
    expect(r.out).toContain('bounce');
    expect((await cli('fmt', file, '--check')).code).toBe(0);
  }
});
it('exposes motion timeline and node properties through registry-derived schema', async () => {
  const timeline = await cli('schema', 'timeline', '--format=json');
  expect(timeline.code).toBe(0);
  for (const key of ['speed', 'quantize', 'work']) expect(timeline.out).toContain(`"${key}"`);
  const circle = await cli('schema', 'circle', '--format=json');
  expect(circle.code).toBe(0);
  expect(circle.out).toContain('pivotX');
  expect(circle.out).toContain('channels');
});
it('samples explicit instance controls using the conformance command language', async () => {
  const folder = 'spec/conformance/host-api-low-level-animation/';
  const r = await cli(
    'sample',
    new URL(folder + 'case.animl', root).pathname,
    '--script',
    new URL(folder + 'script.txt', root).pathname,
  );
  expect(r.code, r.err).toBe(0);
  expect(JSON.parse(r.out)).toEqual(
    JSON.parse(readFileSync(new URL(folder + 'expected.jsonl', root), 'utf8')),
  );
});
