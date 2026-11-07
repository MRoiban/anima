import { expect, it } from 'vitest';
import { run } from '../../../../packages/cli/src/index.ts';
it('sample --semantics attaches the current logical tree to each snapshot', async () => {
  const out: string[] = [],
    err: string[] = [];
  const file = new URL('../../examples/contract.animl', import.meta.url).pathname;
  const code = await run(
    ['sample', file, '--semantics', '-e', 'snapshot\nsemantic volume increase\nsnapshot'],
    { out: (s) => out.push(s), err: (s) => err.push(s) },
  );
  expect({ code, err }).toEqual({ code: 0, err: [] });
  const snapshots = out.map((s) => JSON.parse(s));
  expect(snapshots.map((s) => s.semantics[0].children[1].value)).toEqual([40, 45]);
});
