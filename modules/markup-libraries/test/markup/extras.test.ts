import { expect, it } from 'vitest';
import { compile, compileAsync } from '../../../../packages/markup/src/index.ts';
const lib = `<library name="ui" exports="row Person"><model name="Person"><number name="score" default="3"/></model><component name="row" grid="10" data="Person"><circle id="dot" cx="5" cy="5" r="1" fill="#000"/><bind target="dot.r" value="$score"/></component><component name="private" grid="10"><circle id="x" cx="5" cy="5" r="2" fill="#000"/></component></library>`;
const wrap = (select = '', use = 'ui:row') =>
  `<anima version="0.1" name="library-test" grid="20" requires="components data bind"><import src="ui.animl" as="ui" ${select}/><instance id="one" component="${use}"/></anima>`;
it('ships model definitions and rewrites component public model names', () => {
  const r = compile(wrap(), { resolve: () => lib });
  expect(r.diagnostics).toEqual([]);
  const doc = r.doc as unknown as {
    components: Record<string, { data: string }>;
    data: { models: Record<string, unknown> };
  };
  const row = Object.values(doc.components).find((c) => c.data)!;
  expect(doc.data.models).toHaveProperty(row.data);
});
it('keeps private implementation dependencies available but rejects private public references', () => {
  const r = compile(wrap('', 'ui:private'), { resolve: () => lib });
  expect(r.diagnostics.some((d) => d.code === 'unknown-name')).toBe(true);
});
it('selects public names for sync and async imports', async () => {
  const sync = compile(wrap('select="row"'), { resolve: () => lib });
  const async = await compileAsync(wrap('select="row"'), { resolve: async () => lib });
  expect(sync.diagnostics).toEqual([]);
  expect(async.doc).toEqual(sync.doc);
  expect(compile(wrap('export="row"'), { resolve: () => lib }).doc).toEqual(sync.doc);
  expect(
    compile(wrap(), { resolve: () => lib.replace('exports=', 'export=') }).diagnostics,
  ).toEqual([]);
  for (const select of ['export="missing"', 'select="missing"', 'select="private"']) {
    const d = compile(wrap(select), { resolve: () => lib }).diagnostics.find(
      (d) => d.code === 'unknown-name',
    );
    expect(d?.pointer).toBeDefined();
    expect(d?.message).toBeTruthy();
    expect(d?.hint).toBeTruthy();
  }
});
