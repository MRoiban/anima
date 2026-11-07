import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/cli.ts';
const invoke = async (...args: string[]) => {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  expect(err).toEqual([]);
  expect(code).toBe(0);
  return out.join('\n');
};
it('B17/B18: CLI docs expose node roles/modal/expanded/controls and easing recipes for data and convert', async () => {
  const a11y = await invoke('docs', 'a11y');
  for (const term of [
    'progressbar',
    'meter',
    'status',
    'controls',
    'modal',
    'expanded',
    'schema a11y',
  ])
    expect(a11y).toContain(term);
  for (const topic of ['data', 'convert']) {
    const docs = await invoke('docs', topic);
    expect(docs).toContain('travelling');
    expect(docs).toContain('duration="200"');
    expect(docs).toContain('cubic(0.42, 0, 1, 1)');
  }
  expect(await invoke('schema', 'a11y')).toContain('progressbar');
});
it('B17: CLI semantic snapshots expose new roles, indeterminate progress and controls', async () => {
  const result = await invoke(
    'sample',
    'spec/conformance/a11y-bf4-roles/case.animl',
    '--semantics',
    '-e',
    'advance 0\nsnapshot',
  );
  for (const term of ['progressbar', 'meter', 'status', 'controls', 'polite'])
    expect(result).toContain(term);
});
