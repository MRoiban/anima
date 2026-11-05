import { describe, expect, it } from 'vitest';
import { compile, compileAsync, formatMarkup } from '../src/index.ts';

const wrap = (s: string) => `<anima version="0.1" name="test" grid="20">${s}</anima>`;
const lib = (s: string) => `<library name="ui">${s}</library>`;
const imported = (s: string) => wrap(`<import src="lib/ui.animl" as="ui"/>${s}`);
const build = (body: string, library: string) =>
  compile(imported(body), {
    file: 'icons/test.animl',
    resolve: (path) => {
      expect(path).toBe('icons/lib/ui.animl');
      return lib(library);
    },
  });

describe('build-time libraries and templates', () => {
  it('expands attributes, defaults, keyframe text and nested applications', () => {
    const r = build(
      '<circle id="dot" cx="1" cy="1" r="1" fill="#000"/><apply template="ui:outer" target="dot"/>',
      `
<template name="inner" params="target scale=0.92">
  <timeline name="press" duration="1"><track target="{target}.scale">0 1 out; 1 {scale}</track></timeline>
</template>
<template name="outer" params="target"><apply template="inner" target="{target}"/></template>`,
    );
    expect(r.diagnostics).toEqual([]);
    expect(r.doc?.timelines).toEqual({
      press: {
        duration: 1,
        tracks: {
          'dot.scale': [
            [0, 1, 'out'],
            [1, 0.92],
          ],
        },
      },
    });
    expect(r.text).not.toMatch(/template|import|apply/);
  });
  it('resolves colours, glyphs and eases in the library lexical scope', () => {
    const r = build(
      '<apply template="ui:shape"/>',
      `
<color name="ink" value="#abc"/><glyph name="line" d="M0 0L2 2"/><ease name="soft" curve="out"/>
<template name="shape"><path id="dot" glyph="line" fill="ink"/><timeline name="go" duration="1"><track target="dot.opacity">0 0 ui:soft; 1 1</track></timeline></template>`,
    );
    // A library's own names are unqualified; the document alias does not enter its scope.
    expect(r.diagnostics[0]?.code).toBe('unknown-name');
    const direct = build(
      '<path id="dot" glyph="ui:line" fill="ui:ink"/><timeline name="go" duration="1"><track target="dot.opacity">0 0 ui:soft; 1 1</track></timeline>',
      '<color name="ink" value="#abc"/><glyph name="line" d="M0 0L2 2"/><ease name="soft" curve="out"/>',
    );
    expect(direct.diagnostics).toEqual([]);
    expect(direct.text).not.toContain('ui:');
  });
  it.each([
    [
      'missing-parameter',
      '<template name="t" params="target"><listener on="click" emit="{target}"/></template>',
      '<apply template="ui:t"/>',
    ],
    ['unknown-parameter', '<template name="t"/>', '<apply template="ui:t" typo="1"/>'],
    ['unused-parameter', '<template name="t" params="unused=1"/>', '<apply template="ui:t"/>'],
    [
      'unknown-parameter',
      '<template name="t"><listener on="click" emit="{typo}"/></template>',
      '<apply template="ui:t"/>',
    ],
    [
      'template-recursion',
      '<template name="t"><apply template="t"/></template>',
      '<apply template="ui:t"/>',
    ],
    [
      'unknown-name',
      '<template name="t"><path id="x" glyph="bad:name"/></template>',
      '<apply template="ui:t"/>',
    ],
    [
      'bad-attribute',
      '<template name="t"><circle id="x" cx="bad" cy="0" r="1" fill="#000"/></template>',
      '<apply template="ui:t"/>',
    ],
    ['components-unavailable', '<component name="badge" grid="8"/>', ''],
    ['misplaced-element', '<listener on="click"/>', ''],
    ['duplicate-name', '<template name="t"/><template name="t"/>', ''],
  ])('%s has the imported origin and a related use site', (code, library, body) => {
    const r = build(body, '\n' + library);
    expect(r.text).toBeUndefined();
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        file: 'icons/lib/ui.animl',
        line: 2,
        related: expect.arrayContaining([
          expect.objectContaining({ file: 'icons/test.animl', line: 1 }),
        ]),
      }),
    );
  });
  it('maps strict loader errors and keyframe errors back into templates', () => {
    const r = build(
      '<apply template="ui:t"/>',
      '\n<template name="t"><circle id="x" cx="0" cy="0" r="-1"/></template>',
    );
    expect(r.diagnostics[0]).toMatchObject({
      file: 'icons/lib/ui.animl',
      line: 2,
      related: [{ file: 'icons/test.animl' }],
    });
    const frames = build(
      '<apply template="ui:t"/>',
      '\n<template name="t"><timeline name="go" duration="1"><track target="x.scale">bad</track></timeline></template>',
    );
    expect(frames.diagnostics[0]).toMatchObject({
      code: 'bad-keyframe',
      file: 'icons/lib/ui.animl',
      line: 2,
    });
  });
  it('reports missing files, wrong roots, malformed libraries, unknown templates and cycles', () => {
    expect(compile(imported('')).diagnostics[0]?.code).toBe('unknown-import');
    expect(compile(imported(''), { resolve: () => '<anima/>' }).diagnostics[0]?.code).toBe(
      'bad-import',
    );
    expect(compile(imported(''), { resolve: () => '<library>' }).diagnostics[0]?.code).toBe(
      'markup-syntax',
    );
    expect(build('<apply template="ui:no"/>', '').diagnostics[0]?.code).toBe('unknown-name');
    const r = compile(imported(''), {
      file: 'test.animl',
      resolve: () => lib('<import src="ui.animl" as="again"/>'),
    });
    expect(r.diagnostics[0]).toMatchObject({
      code: 'import-cycle',
      file: 'lib/ui.animl',
      related: [{ file: 'test.animl' }],
    });
  });
  it('loads transitive imports asynchronously relative to each file', async () => {
    const paths: string[] = [];
    const r = await compileAsync(imported('<apply template="ui:other:t"/>'), {
      file: 'https://example.test/icons/test.animl',
      resolve: async (path) => {
        paths.push(path);
        return path.endsWith('ui.animl')
          ? lib('<import src="../other.animl" as="other"/>')
          : lib('<template name="t"><circle id="x" cx="1" cy="1" r="1" fill="#000"/></template>');
      },
    });
    expect(r.diagnostics).toEqual([]);
    expect(paths).toEqual([
      'https://example.test/icons/lib/ui.animl',
      'https://example.test/icons/other.animl',
    ]);
  });
  it('keeps templates and applies when formatting', () => {
    const source = lib(
      '<template name="t" params="x=1"><circle id="dot" cx="{x}" cy="0" r="1" fill="#000"/></template><apply template="t"/>',
    );
    const r = formatMarkup(source);
    expect(r.diagnostics).toEqual([]);
    expect(r.text).toContain('params="x=1"');
    expect(r.text).toContain('<apply template="t"/>');
  });
});

it('preserves imported keyframe line and column after length-changing substitutions', () => {
  const library =
    '<library name="ui">\n<template name="t" params="target value=0.123456789">\n<timeline name="go" duration="1"><track target="{target}.scale">\n0 {value}\n1 bad\n</track></timeline></template></library>';
  const r = compile(
    imported(
      '<circle id="dot" cx="1" cy="1" r="1" fill="#000"/><apply template="ui:t" target="dot"/>',
    ),
    { file: 'test.animl', resolve: () => library },
  );
  expect(r.diagnostics[0]).toMatchObject({
    code: 'value-type',
    file: 'lib/ui.animl',
    line: 5,
    column: 3,
  });
});
it('keeps resource kinds separate and resolves library-local keyframe eases', () => {
  const r = build(
    '<apply template="ui:t"/>',
    '<color name="ink" value="#abc"/><glyph name="ink" d="M0 0L1 1"/><ease name="soft" curve="out"/><template name="t"><path id="p" glyph="ink" fill="ink"/><timeline name="go" duration="1"><track target="p.opacity">0 0 soft; 1 1</track></timeline></template>',
  );
  expect(r.diagnostics).toEqual([]);
  expect(r.text).toContain('"out"');
});
