import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile, decompile, formatMarkup } from '@anima-format/markup';
import { describe, expect, it } from 'vitest';
import { run } from '../src/cli.ts';
import { nodeAttrs } from '../../markup/src/names.ts';

const root = new URL('../../../', import.meta.url).pathname;
const bell = join(root, 'examples/bell.animl');
const ani = readFileSync(join(root, 'examples/bell.ani'), 'utf8');
const tmp = mkdtempSync(join(tmpdir(), 'anima-markup-cli-'));
const good =
  '<anima version="0.1" name="dot" grid="20"><circle id="dot" cx="10" cy="10" r="2" fill="currentColor"/></anima>';
const bad =
  '<anima version="0.1" name="dot" grid="20">\n  <circle id="dot" cx="10" cy="10" r="oops"/>\n</anima>';
const put = (name: string, text: string) => {
  const f = join(tmp, name);
  writeFileSync(f, text);
  return f;
};
async function cli(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(argv, {
    out: (s) => out.push(s),
    write: (s) => out.push(s),
    err: (s) => err.push(s),
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('AniML authoring commands', () => {
  it('validate, inspect, sample and render accept markup with the same result as JSON', async () => {
    for (const cmd of ['validate', 'inspect', 'sample']) {
      const r = await cli(cmd, bell, '--format=json');
      expect(r.code, r.err).toBe(0);
      const json = await cli(cmd, join(root, 'examples/bell.ani'), '--format=json');
      if (cmd !== 'validate') expect(r.out).toBe(json.out);
    }
    const svg = join(tmp, 'bell.svg');
    expect((await cli('render', bell, '-o', svg)).code).toBe(0);
    expect(readFileSync(svg, 'utf8')).toContain('<svg ');
  });

  it('validate reports exact markup line/column, fields and hint', async () => {
    const f = put('bad.animl', bad);
    const r = await cli('validate', f, '--format=json');
    expect(r.code).toBe(1);
    expect(JSON.parse(r.out).diagnostics[0]).toMatchObject({
      file: f,
      line: 2,
      column: 39,
      code: 'bad-attribute',
      severity: 'error',
      pointer: '/nodes/0/r',
      message: expect.any(String),
    });
    expect((await cli('validate', f)).err).toContain(`${f}:2:39 error bad-attribute`);
    const typo = put('typo.animl', good.replace('r="2"', 'radius="2"'));
    expect((await cli('validate', typo)).err).toContain('\n  hint:');
  });

  it.each(['inspect', 'sample', 'render'])('%s reports markup errors as JSON', async (cmd) => {
    const f = put('invalid.animl', bad);
    const out = join(tmp, `${cmd}-bad.svg`);
    const r = await cli(cmd, f, '--format=json', ...(cmd === 'render' ? ['-o', out] : []));
    expect(r.code).toBe(1);
    expect(JSON.parse(r.out).diagnostics[0]).toMatchObject({ file: f, line: 2, column: 39 });
    expect(existsSync(out)).toBe(false);
  });

  it('fmt uses formatMarkup, keeps comments, and supports check/write', async () => {
    const source = good.replace('<circle', '<!--keep--><circle');
    const f = put('fmt.animl', source);
    expect((await cli('fmt', f, '--check')).code).toBe(1);
    expect(readFileSync(f, 'utf8')).toBe(source);
    expect((await cli('fmt', f, '--write')).code).toBe(0);
    expect(readFileSync(f, 'utf8')).toBe(formatMarkup(source).text);
    expect((await cli('fmt', f, '--check')).code).toBe(0);
    expect((await cli('fmt', f)).out).toContain('<!--keep-->');
    const broken = put('syntax.animl', '<anima');
    expect(
      JSON.parse((await cli('fmt', broken, '--format=json')).out).diagnostics[0],
    ).toMatchObject({ file: broken, code: 'markup-syntax' });
  });

  it('maps CLI glyph hash warnings back to markup', async () => {
    const f = put(
      'hash.animl',
      readFileSync(bell, 'utf8')
        .replace('src="lib/ui.animl"', `src="${join(root, 'examples/lib/ui.animl')}"`)
        .replace('M9.493 4.473', 'M9.494 4.473'),
    );
    const r = await cli('validate', f, '--format=json');
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).diagnostics[0]).toMatchObject({
      file: f,
      code: 'hash-mismatch',
      line: expect.any(Number),
      column: expect.any(Number),
    });
  });

  it.each(readdirSync(join(root, 'fixtures/glyphs')).filter((f) => f.endsWith('.svg')))(
    'new %s scaffolds zero-diagnostic markup',
    async (glyph) => {
      const out = join(tmp, glyph.replace('.svg', '.animl'));
      const r = await cli(
        'new',
        glyph.replace('.svg', ''),
        '--glyph',
        join(root, 'fixtures/glyphs', glyph),
        '-o',
        out,
      );
      expect(r.code, r.err).toBe(0);
      expect(compile(readFileSync(out, 'utf8')).diagnostics).toEqual([]);
    },
  );

  it('new defaults to .animl, supports Glyphy metadata, and retains --ani', async () => {
    const cwd = process.cwd();
    process.chdir(tmp);
    try {
      expect((await cli('new', 'bell', '--glyphy', join(root, 'fixtures'), '--force')).code).toBe(
        0,
      );
      const compiled = compile(readFileSync('bell.animl', 'utf8'));
      expect(compiled.diagnostics).toEqual([]);
      expect(compiled.doc?.meta).toHaveProperty('glyphy');
      expect((await cli('new', 'bell', '--glyphy', join(root, 'fixtures'), '--ani')).code).toBe(0);
      expect(JSON.parse(readFileSync('bell.ani', 'utf8')).anima).toBe('0.1');
    } finally {
      process.chdir(cwd);
    }
  });
});

describe('build and decompile', () => {
  it('builds bell byte-for-byte to stdout or a file', async () => {
    expect((await cli('build', bell)).out).toBe(ani);
    expect(
      execFileSync(process.execPath, [join(root, 'packages/cli/src/main.ts'), 'build', bell], {
        encoding: 'utf8',
      }),
    ).toBe(ani);
    const out = join(tmp, 'built.ani');
    expect((await cli('build', bell, '-o', out)).code).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe(ani);
  });

  it('build fails without writing for loader errors as well as markup errors', async () => {
    for (const [name, text] of [
      ['markup', bad],
      ['loader', good.replace('grid="20"', 'grid="0"')],
    ]) {
      const f = put(`${name}.animl`, text!);
      const out = put(`${name}.ani`, 'unchanged');
      const r = await cli('build', f, '-o', out, '--format=json');
      expect(r.code).toBe(1);
      expect(JSON.parse(r.out).diagnostics[0]).toMatchObject({
        file: f,
        line: expect.any(Number),
        column: expect.any(Number),
      });
      expect(readFileSync(out, 'utf8')).toBe('unchanged');
    }
  });

  it('build HTML preserves every other byte, skips comments/raw text, and compiles multiple icons', async () => {
    const outside = `<script type='application/vnd.anima+xml'>${bad}</script>`;
    const before = `<!doctype html>\r\n<!-- <anima-icon>${outside}</anima-icon> -->\n<style>/* <anima-icon> */</style>\n${outside}\n`;
    const opening = `<ANIMA-ICON title=">" ><SCRIPT data-x="type='wrong'" TYPE = 'application/vnd.anima+xml'>`;
    const after = '</SCRIPT></ANIMA-ICON>\n<footer>  keep   </footer>  \n\n';
    const page = before + opening + good + after + opening + good + after;
    const f = put('page.html', page);
    const out = join(tmp, 'built.html');
    const r = await cli('build', f, '-o', out);
    expect(r.code, r.err).toBe(0);
    expect(r.err).toContain('warning markup-outside-icon');
    const replacement =
      opening.replace('application/vnd.anima+xml', 'application/vnd.anima+json') +
      compile(good).text +
      after;
    expect(readFileSync(out, 'utf8')).toBe(before + replacement + replacement);
    expect((await cli('build', f)).out).toBe(before + replacement + replacement);
  });

  it('scans unquoted types, nested icons and literal less-than signs without touching raw text', async () => {
    const script = `<script type=application/vnd.anima+xml>${good}</script>`;
    const before = `<textarea><anima-icon>${script}</anima-icon></textarea><p>1 < 2</p>`;
    const f = put(
      'unquoted.html',
      `${before}<anima-icon><anima-icon>${script}</anima-icon>${script}</anima-icon>  \n`,
    );
    const r = await cli('build', f);
    expect(r.code, r.err).toBe(0);
    const compiled = `<script type=application/vnd.anima+json>${compile(good).text}</script>`;
    const expected = `${before}<anima-icon><anima-icon>${compiled}</anima-icon>${compiled}</anima-icon>  \n`;
    expect(r.out).toBe(expected);
    expect(
      execFileSync(process.execPath, [join(root, 'packages/cli/src/main.ts'), 'build', f], {
        encoding: 'utf8',
      }),
    ).toBe(expected);
  });

  it('build HTML errors point at exact HTML line/column and write nothing', async () => {
    const f = put(
      'invalid.html',
      `<p>before</p>\n<anima-icon><script type="application/vnd.anima+xml">${bad}</script></anima-icon>`,
    );
    const out = join(tmp, 'must-not-exist.html');
    const r = await cli('build', f, '-o', out, '--format=json');
    expect(r.code).toBe(1);
    expect(JSON.parse(r.out).diagnostics[0]).toMatchObject({
      file: f,
      line: 3,
      column: 39,
      code: 'bad-attribute',
    });
    expect(existsSync(out)).toBe(false);
    expect((await cli('build', f)).err).toContain(`${f}:3:39 error bad-attribute`);
    const same = put(
      'same-line.html',
      `<anima-icon><script type="application/vnd.anima+xml">${good.replace('r="2"', 'r="oops"')}</script></anima-icon>`,
    );
    const d = JSON.parse((await cli('build', same, '--format=json')).out).diagnostics[0];
    expect(d).toMatchObject({ line: 1, column: 132 });
  });

  it('escapes HTML closing-script hazards in compiled JSON', async () => {
    const f = put(
      'safe.html',
      `<anima-icon><script type="application/vnd.anima+xml">${good.replace('name="dot"', 'name="dot" title="&lt;/script>"')}</script></anima-icon>`,
    );
    const r = await cli('build', f);
    expect(r.code, r.err).toBe(0);
    expect(r.out).toContain('\\u003c/script>');
    expect(r.out.match(/<\/script>/g)).toHaveLength(1);
  });

  it('decompiles canonical markup to stdout or file and rejects invalid JSON', async () => {
    const f = join(root, 'examples/bell.ani');
    expect((await cli('decompile', f)).out).toBe(decompile(ani).trimEnd());
    const out = join(tmp, 'decompiled.animl');
    expect((await cli('decompile', f, '-o', out)).code).toBe(0);
    expect(compile(readFileSync(out, 'utf8')).text).toBe(ani);
    expect((await cli('decompile', put('no.ani', '{}'))).code).toBe(1);
  });
});

describe('markup discovery', () => {
  it('schema derives both spellings from nodeAttrs including paint and center', async () => {
    for (const type of ['rect', 'circle', 'path', 'fill', 'stroke'] as const) {
      const r = await cli('schema', type);
      for (const a of nodeAttrs(type === 'fill' || type === 'stroke' ? 'path' : type)) {
        if ((type === 'fill' || type === 'stroke') && a.path[0] !== type) continue;
        if (a.attr !== a.path.join('.')) expect(r.out).toContain(`${a.attr} ↔ ${a.path.join('.')}`);
      }
      expect(
        JSON.parse((await cli('schema', type, '--format=json')).out).spellings.length,
      ).toBeGreaterThan(0);
    }
  });

  it('docs markup serves the exact spec and is listed; help explains commands and --ani', async () => {
    expect((await cli('docs', 'markup')).out).toBe(
      readFileSync(join(root, 'spec/ANIML.md'), 'utf8'),
    );
    expect(JSON.parse((await cli('docs', '--list', '--format=json')).out)).toContain('markup');
    const help = (await cli('--help')).out;
    for (const word of ['build', 'decompile', '.animl', '--ani', 'markup'])
      expect(help).toContain(word);
  });
});

it('reports imported diagnostics and the application site in CLI text', async () => {
  const library = put(
    'ui.animl',
    '<library name="ui">\n<template name="t"><circle id="dot" cx="bad" cy="0" r="1"/></template></library>',
  );
  const file = put(
    'import.animl',
    `<anima version="0.1" name="test" grid="20">\n<import src="ui.animl" as="ui"/>\n<apply template="ui:t"/></anima>`,
  );
  const r = await cli('validate', file);
  expect(r.code).toBe(1);
  expect(r.err).toContain(`${library}:2:`);
  expect(r.err).toContain(`related: ${file}:3:`);
});
