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

const shared = `<library name="ui" export="Person main Mood">
  <enum name="Mood" values="calm busy"/>
  <model name="Person"><number name="score" default="3"/><enum name="mood" enum="Mood" default="busy"/></model>
  <instance name="main" model="Person" default="true"><set path="score" value="7"/></instance>
</library>`;
const sharedIcon = (body = '', alias = 'ui') =>
  `<anima version="0.1" name="shared" grid="20" requires="data bind"><import src="ui.animl" as="${alias}"/><circle id="dot" cx="5" cy="5" r="1" fill="#000"/><bind target="dot.r" value="$${alias}:main:score"/>${body}</anima>`;
it('imports authored instances and enums, rewrites named paths and round-trips JSON', async () => {
  const { load, Player } = await import('../../../../packages/core/src/index.ts');
  const { decompile } = await import('../../../../packages/markup/src/index.ts');
  const result = compile(sharedIcon(), { resolve: () => shared });
  expect(result.diagnostics).toEqual([]);
  const loaded = load(result.doc!);
  expect(loaded.diagnostics).toEqual([]);
  const player = new Player(loaded.model!);
  player.step(0);
  expect(player.values()['dot.r']).toBe(7);
  expect(player.get('$mood')).toBe('busy');
  const canonical = compile(decompile(result.doc!));
  expect(canonical.diagnostics).toEqual([]);
  expect(canonical.doc).toEqual(result.doc);
  expect((await compileAsync(sharedIcon(), { resolve: async () => shared })).doc).toEqual(
    result.doc,
  );
});
it('keeps imported data collision-free across two aliases and local declarations', () => {
  const source = sharedIcon(
    '<import src="ui.animl" as="other"/><model name="Person"><number name="score"/></model><enum name="Mood" values="local"/><instance name="main" model="Person"/>',
  );
  const r = compile(source, { resolve: () => shared.replace('default="true"', '') });
  expect(r.diagnostics).toEqual([]);
  const data = r.doc!.data as Record<string, Record<string, unknown>>;
  expect(Object.keys(data.models!)).toHaveLength(3);
  expect(Object.keys(data.instances!)).toHaveLength(3);
  expect(Object.keys(data.enums!)).toHaveLength(3);
});
it.each([
  ['unknown-name', sharedIcon().replace('ui:main:score', 'ui:missing:score'), shared],
  ['unknown-name', sharedIcon(), shared.replace('Person main Mood', 'Person Mood')],
  [
    'unknown-name',
    sharedIcon('<model name="Local"><enum name="mood" enum="ui:missing"/></model>'),
    shared,
  ],
  [
    'duplicate-name',
    sharedIcon(),
    shared.replace('</library>', '<enum name="Mood" values="x"/></library>'),
  ],
  ['bad-attribute', sharedIcon(), shared.replace('name="main"', 'name="1bad"')],
])('reports %s for invalid shared data declarations/references', (code, source, library) => {
  const r = compile(source, { resolve: () => library });
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      pointer: expect.any(String),
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});

it('retains data validation and source locations for bad enum members and instance values', () => {
  for (const library of [
    shared.replace('default="busy"', 'default="missing"'),
    shared.replace('value="7"', 'value="wrong"'),
    shared.replace('model="Person"', 'model="Missing"'),
  ]) {
    const r = compile(sharedIcon(), { file: 'icon.animl', resolve: () => library });
    expect(r.doc).toBeUndefined();
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code: expect.stringMatching(/^data-/),
        pointer: expect.stringMatching(/^\/data\//),
        message: expect.any(String),
        hint: expect.any(String),
        file: 'ui.animl',
      }),
    );
  }
});

it('resolves a public library enum in a consumer model and selection aliases', () => {
  for (const selection of ['export', 'select']) {
    const r = compile(
      sharedIcon('<model name="Local"><enum name="mood" enum="ui:Mood"/></model>').replace(
        'as="ui"',
        `as="ui" ${selection}="main Mood"`,
      ),
      { resolve: () => shared },
    );
    expect(r.diagnostics).toEqual([]);
    const data = r.doc!.data as {
      models: Record<string, { properties: Record<string, { enum?: string }> }>;
      enums: Record<string, unknown>;
    };
    expect(data.enums).toHaveProperty(data.models.Local!.properties.mood!.enum!);
  }
});
