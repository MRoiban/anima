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
it('serves every module spec chapter as a listed docs topic', async () => {
  const spec = readFileSync(new URL('spec/SPEC.md', root), 'utf8');
  const names = [...spec.matchAll(/^## ([a-z]+)$/gm)].map((m) => m[1]!);
  const topics = JSON.parse((await cli('docs', '--list', '--format=json')).out);
  for (const name of names) {
    expect(topics).toContain(name);
    const r = await cli('docs', name);
    expect(r.code).toBe(0);
    expect(r.out.startsWith('## ' + name + '\n')).toBe(true);
    expect((r.out.match(/^## /gm) ?? []).length).toBe(1);
  }
  expect((await cli('schema', 'state')).out).toContain('time');
  expect((await cli('schema', 'transition')).out).toContain('exitNext');
});
it('reproduces all committed sync acceptance samples with the CLI', async () => {
  for (const name of ['rest', 'spin', 'sweep', 'stop', 'hover', 'phase', 'reduced']) {
    const base = new URL('modules/motion/examples/', root);
    const r = await cli(
      'sample',
      new URL('sync.ani', base).pathname,
      '--script',
      new URL('scripts/' + name + '.txt', base).pathname,
    );
    expect(r.code, r.err).toBe(0);
    expect(r.out.trim()).toBe(
      readFileSync(new URL('evidence/' + name + '.jsonl', base), 'utf8').trim(),
    );
  }
});
