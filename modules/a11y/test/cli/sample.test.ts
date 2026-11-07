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
it('[P3b-9] sample filters semantics by id and validates bound heading metadata', async () => {
  const out: string[] = [],
    err: string[] = [];
  const file = new URL(
    '../../capabilities/a11y-property-heading-level/example.animl',
    import.meta.url,
  ).pathname;
  const code = await run(
    ['sample', file, '-e', 'advance 0\nsemantics item\nset depth 4\nadvance 0\nsemantics item'],
    { out: (s) => out.push(s), err: (s) => err.push(s) },
  );
  expect({ code, err }).toEqual({ code: 0, err: [] });
  expect(out.map((s) => JSON.parse(s))).toEqual([
    {
      id: 'item',
      role: 'heading',
      states: {},
      bounds: [1, 2, 3, 4],
      actions: [],
      children: [],
      level: 2,
    },
    {
      id: 'item',
      role: 'heading',
      states: {},
      bounds: [1, 2, 3, 4],
      actions: [],
      children: [],
      level: 4,
    },
  ]);
});
