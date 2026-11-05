import { describe, it, expect } from 'vitest';
import { compile, decompile, formatMarkup } from '../../../../packages/markup/src/index.ts';

const source = `<anima version="0.1" name="components" grid="20" requires="components bind">
  <number name="unread" default="4"/>
  <component name="badge" grid="8">
    <number name="count" default="1"/>
    <rect id="dot" x0="0" y0="0" width="2" height="3" fill="#f00"/>
    <bind target="dot.width" value="count"/>
    <listener on="click" emit="selected"/>
  </component>
  <instance id="b1" component="badge" count="{unread}"/>
  <instance id="b2" component="badge" count="2"/>
  <listener on="b1.selected" set="b2.count=0"/>
</anima>`;
describe('component markup', () => {
  it('compiles, decompiles and formats component documents without materializing defaults', () => {
    const c = compile(source);
    expect(c.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(c.doc).toMatchObject({
      components: { badge: { bind: { 'dot.w': 'count' } } },
      nodes: [{ inputs: { count: '{unread}' } }, { inputs: { count: 2 } }],
    });
    const xml = decompile(c.doc!);
    expect(xml).not.toContain('inputs=');
    expect(compile(xml).doc).toEqual(c.doc);
    expect(compile(formatMarkup(source).text!).doc).toEqual(c.doc);
  });
  it('imports library components, including templates/resources used inside them', () => {
    const c = compile(
      `<anima version="0.1" name="test" grid="20" requires="components"><import src="ui.animl" as="ui"/><instance id="badge" component="ui:badge"/></anima>`,
      {
        file: 'test.animl',
        resolve: () =>
          `<library name="ui"><color name="ink" value="#123"/><template name="dot"><circle id="dot" cx="4" cy="4" r="2" fill="ink"/></template><component name="badge" grid="8"><apply template="dot"/></component></library>`,
      },
    );
    expect(c.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(c.doc!.components).toBeTruthy();
    const name = (c.doc!.nodes as { component: string }[])[0]!.component;
    expect((c.doc!.components as Record<string, unknown>)[name]).toBeTruthy();
    expect(compile(decompile(c.doc!)).doc).toEqual(c.doc);
  });
  it('maps unknown instance inputs to their attribute in the source file', () => {
    const c = compile(source.replace('count="{unread}"', 'missing="3"'));
    expect(c.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unknown-input',
        pointer: '/nodes/0/inputs/missing',
        line: 9,
      }),
    );
  });
});

it('isolates component node ids, local colour names and local ease aliases', () => {
  const source = `<anima version="0.1" name="scope" grid="20" requires="components">
    <import src="ui.animl" as="ui"/>
    <circle id="dot" cx="4" cy="4" r="2" fill="#000"/>
    <timeline name="root" duration="1"><track target="dot.r">0 2; 1 3</track></timeline>
    <instance id="a" component="ui:badge"/>
  </anima>`;
  const result = compile(source, {
    resolve: () =>
      `<library name="ui"><color name="ink" value="#f00"/><ease name="soft" curve="out"/><component name="badge" grid="8"><color name="ink" value="#0f0"/><ease name="soft" curve="in"/><rect id="dot" x0="0" y0="0" width="2" height="3" fill="ink"/><timeline name="grow" duration="1"><track target="dot.width">0 2 soft; 1 4</track></timeline></component></library>`,
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const component = Object.values(
    result.doc!.components as Record<string, Record<string, unknown>>,
  )[0]!;
  expect(component.colors).toMatchObject({ ink: '#0f0' });
  expect(component.timelines).toMatchObject({
    grow: {
      tracks: {
        'dot.w': [
          [0, 2, 'in'],
          [1, 4],
        ],
      },
    },
  });
  expect(compile(decompile(result.doc!)).doc).toEqual(result.doc);
});

it('locates reserved input declarations and leaves instance transforms unambiguous', () => {
  const bad = compile(
    `<anima version="0.1" name="reserved" grid="20" requires="components">
  <component name="badge" grid="8">
    <number name="x"/>
    <circle id="dot" cx="4" cy="4" r="2" fill="#f00"/>
  </component>
  <instance id="b" component="badge" x="12"/>
</anima>`,
    { file: 'reserved.animl' },
  );
  expect(bad.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'reserved-input-name',
      pointer: '/components/badge/inputs/x',
      file: 'reserved.animl',
      line: 3,
      column: 5,
      hint: 'rename the input; x is an instance property (e.g. use pos-x)',
    }),
  );
});

it('shares ease declaration rules across document and component scopes', () => {
  const source = `<anima version="0.1" name="eases" grid="8" requires="components">
    <ease name="soft" curve="out"/>
    <component name="badge" grid="8">
      <ease name=" soft " curve="in"/>
      <circle id="dot" cx="4" cy="4" r="1" fill="#000"/>
      <timeline name="grow" duration="1"><track target="dot.r">0 1 soft; 1 2</track></timeline>
    </component>
    <instance id="b" component="badge"/>
  </anima>`;
  const result = compile(source);
  expect(result.diagnostics).toEqual([]);
  expect(result.doc).toMatchObject({
    components: {
      badge: {
        timelines: {
          grow: {
            tracks: {
              'dot.r': [
                [0, 1, 'in'],
                [1, 2],
              ],
            },
          },
        },
      },
    },
  });
  expect(
    compile(
      source.replace(
        '<ease name=" soft " curve="in"/>',
        '<ease name="soft" curve="in"/><ease name=" soft " curve="hold"/>',
      ),
    ).diagnostics,
  ).toContainEqual(
    expect.objectContaining({ code: 'duplicate-name', pointer: '/components/badge', line: 4 }),
  );
});

it('keeps missing ease attributes diagnostic in both declaration scopes', () => {
  for (const body of [
    '<ease name="missing"/>',
    '<component name="badge" grid="8"><ease name="missing"/></component>',
  ]) {
    const result = compile(
      `<anima version="0.1" name="eases" grid="8" requires="components">${body}</anima>`,
    );
    expect(result.doc).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'missing-attribute', hint: expect.any(String), line: 1 }),
    );
    expect(result.diagnostics.some((d) => d.code === 'markup-syntax')).toBe(false);
  }
});
