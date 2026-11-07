import { expect, it } from 'vitest';
import { compile as rawCompile, decompile } from '../../../../packages/markup/src/index.ts';
const compile = (...args: Parameters<typeof rawCompile>) => {
  const r = rawCompile(...args);
  return {
    ...r,
    doc: r.doc as
      | undefined
      | {
          components: Record<string, object>;
          meta: { componentNames: Record<string, string>; author?: string };
          nodes: { component: string }[];
        },
  };
};
const library =
  '<library name="ui"><component name="switch" grid="10"><circle id="dot" cx="5" cy="5" r="1" fill="#123456"/></component></library>';
const source = (body = '') =>
  `<anima version="0.1" name="names" grid="10" requires="components"><import src="ui.animl" as="ui"/>${body}<instance id="one" component="ui:switch"/></anima>`;
it('[BF-1] preserves a unique imported component name and qualified lookup metadata', () => {
  const r = compile(source(), { resolve: () => library });
  expect(r.diagnostics).toEqual([]);
  expect(Object.keys(r.doc!.components)).toEqual(['switch']);
  expect(r.doc!.meta.componentNames).toEqual({ 'ui:switch': 'switch' });
  expect(compile(decompile(r.doc!)).doc).toEqual(r.doc);
});
it('[BF-1] qualifies both colliding imports deterministically', () => {
  const r = compile(source('<import src="ui.animl" as="other"/>'), { resolve: () => library });
  expect(r.diagnostics).toEqual([]);
  expect(Object.keys(r.doc!.components)).toEqual(['ui:switch', 'other:switch']);
});
it('[BF-1] resolves an unambiguous original name in AniML', () => {
  const r = compile(source().replace('component="ui:switch"', 'component="switch"'), {
    resolve: () => library,
  });
  expect(r.diagnostics).toEqual([]);
  expect(r.doc!.nodes[0].component).toBe('switch');
});
it('[BF-1] diagnoses ambiguous original names with qualified alternatives', () => {
  const r = compile(
    source('<import src="ui.animl" as="other"/>').replace(
      'component="ui:switch"',
      'component="switch"',
    ),
    { resolve: () => library },
  );
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'ambiguous-component',
      pointer: expect.any(String),
      message: expect.any(String),
      hint: expect.stringContaining('ui:switch'),
    }),
  );
});

it('[BF-1] keeps local components and qualifies colliding imports; preserves nested aliases and metadata', () => {
  const local =
    '<component name="switch" grid="10"><circle id="local" cx="1" cy="1" r="1" fill="#000"/></component>';
  const r = compile(source(local + '<meta>{"author":"test"}</meta>'), { resolve: () => library });
  expect(r.diagnostics).toEqual([]);
  expect(Object.keys(r.doc!.components)).toEqual(['ui:switch', 'switch']);
  expect(r.doc!.meta).toEqual({ author: 'test', componentNames: { 'ui:switch': 'ui:switch' } });
  const nested = compile(source(), {
    resolve: (p) =>
      p === 'ui.animl'
        ? '<library name="outer"><import src="inner.animl" as="inner"/></library>'
        : library,
  });
  // The nested alias is public as ui:inner:switch.
  expect(nested.diagnostics).toContainEqual(expect.objectContaining({ code: 'unknown-name' }));
  const valid = compile(source().replace('ui:switch', 'ui:inner:switch'), {
    resolve: (p) =>
      p === 'ui.animl'
        ? '<library name="outer"><import src="inner.animl" as="inner"/></library>'
        : library,
  });
  expect(valid.diagnostics).toEqual([]);
  expect(valid.doc!.meta.componentNames).toEqual({ 'ui:inner:switch': 'switch' });
});
it.each(['broken', 'null', '3', '[]'])(
  '[BF-1] diagnoses malformed metadata %s during import expansion',
  (value) => {
    expect(
      compile(source(`<meta>${value}</meta>`), { resolve: () => library }).diagnostics,
    ).toContainEqual(expect.objectContaining({ code: 'bad-attribute' }));
  },
);
it('[BF-1] supports a qualified component in a repeat and round-trips it', () => {
  const xml = source(
    '<import src="ui.animl" as="other"/><model name="Rows"><number name="count" default="2"/></model><repeat id="rows" count="$count" component="ui:switch"/>',
  ).replace('requires="components"', 'requires="components nested lists data"');
  const r = compile(xml, { resolve: () => library });
  expect(r.diagnostics).toEqual([]);
  expect(r.doc!.nodes[0].component).toBe('ui:switch');
  expect(compile(decompile(r.doc!)).doc).toEqual(r.doc);
});

it('[BF-1] preserves metadata comments while recording aliases', () => {
  const r = compile(source('<meta><!--author note-->{"author":"test"}</meta>'), {
    resolve: () => library,
  });
  expect(r.diagnostics).toEqual([]);
  expect(r.doc!.meta).toMatchObject({ author: 'test', $comment: 'author note' });
});
