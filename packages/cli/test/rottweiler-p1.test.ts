import { afterEach, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { load } from '@anima-format/core';
import { run } from '../src/cli.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const dir = () => {
  const d = mkdtempSync(resolve(tmpdir(), 'anima-rottweiler-p1-'));
  dirs.push(d);
  return d;
};
const doc = (extra: Record<string, unknown> = {}) => ({
  anima: '0.1',
  name: 'probe',
  grid: 20,
  ...extra,
  nodes: [{ id: 'n', type: 'circle', center: [10, 10], r: 5, fill: { color: '#000' } }],
});
const cli = async (argv: string[]) => {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(argv, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out, err };
};

// Rottweiler P1 R2-04: `$comment` in the glyph map (SPEC §2) is not a glyph.
it('inspects a document whose glyph map has a $comment', async () => {
  const f = resolve(dir(), 'c.ani');
  writeFileSync(f, JSON.stringify(doc({ glyphs: { $comment: 'allowed' } })));
  const r = await cli(['inspect', f, '--format=json']);
  expect(r.code).toBe(0);
  expect(JSON.parse(r.out[0]!).glyphs).toEqual({});
});

// Rottweiler P1 R2-11: render fails, like sample, on failed expectations or an unfinished script.
it('fails render on a failed script expectation or an unclosed group, writing nothing', async () => {
  const d = dir();
  const f = resolve(d, 'p.ani');
  writeFileSync(f, JSON.stringify(doc()));
  const failed = await cli(['render', f, '-e', 'expect n.r == 99', '-o', resolve(d, 'a.svg')]);
  expect(failed.code).toBe(1);
  expect(JSON.parse(failed.err[0]!).code).toBe('script-expect');
  expect(existsSync(resolve(d, 'a.svg'))).toBe(false);
  const group = await cli(['render', f, '-e', 'group x', '-o', resolve(d, 'b.svg')]);
  expect(group.code).not.toBe(0);
  expect(group.err.join('\n')).toContain('unclosed group');
  expect(existsSync(resolve(d, 'b.svg'))).toBe(false);
  expect((await cli(['render', f, '-e', 'expect n.r == 5', '-o', resolve(d, 'c.svg')])).code).toBe(
    0,
  );
});

// Rottweiler P1 R2-12: a document name may start with a digit, a glyph name may not.
it('scaffolds a valid glyph name for a digit-leading document name', async () => {
  const d = dir();
  writeFileSync(resolve(d, 'g.svg'), '<svg viewBox="0 0 20 20"><path d="M0 0L20 0L0 20Z"/></svg>');
  for (const format of [['--ani'], []]) {
    const out = resolve(d, format.length ? '1up.ani' : '1up.animl');
    const r = await cli(['new', '1up', '--glyph', resolve(d, 'g.svg'), ...format, '-o', out]);
    expect(r.code, r.err.join('\n')).toBe(0);
    const v = await cli(['validate', out, '--format=json']);
    expect(JSON.parse(v.out[0]!).diagnostics).toEqual([]);
  }
  expect(Object.keys(JSON.parse(readFileSync(resolve(d, '1up.ani'), 'utf8')).glyphs)).toEqual([
    'glyph-1up',
  ]);
  expect(load(readFileSync(resolve(d, '1up.ani'), 'utf8')).diagnostics).toEqual([]);
});

// Rottweiler P1 R3-04: deep metadata cannot make the duplicate-key scan fail open.
it('reports duplicate keys next to deeply nested metadata', async () => {
  const f = resolve(dir(), 'deep.ani');
  const nested = '['.repeat(10_000) + ']'.repeat(10_000);
  writeFileSync(
    f,
    `{"anima":"0.1","name":"probe","grid":20,"grid":20,"meta":{"nested":${nested}},"nodes":[{"id":"n","type":"circle","center":[10,10],"r":5,"fill":{"color":"#000"}}]}`,
  );
  const r = await cli(['validate', f, '--format=json']);
  expect(r.code).toBe(1);
  // Free-form JSON now counts toward the 96-level nesting limit (review follow-up).
  expect(JSON.parse(r.out[0]!).diagnostics.map((d: { code: string }) => d.code)).toEqual([
    'duplicate-key',
    'limit-exceeded',
  ]);
});

// Rottweiler P1 R3-09: browsers decode character references in the script type.
it('builds an AniML script whose type uses character references', async () => {
  const { buildHTML } = await import('../src/html.ts');
  const animl =
    '<anima version="0.1" name="probe" grid="20"><circle id="d" cx="10" cy="10" r="5" fill="#000"/></anima>';
  for (const type of ['application/vnd.anima&#43;xml', 'application&sol;vnd.anima&plus;xml']) {
    const r = buildHTML(
      `<anima-icon><script type="${type}">${animl}</script></anima-icon>`,
      'p.html',
    );
    expect(r.diagnostics).toEqual([]);
    expect(r.text).toContain('type="application/vnd.anima+json"');
  }
  // R4-03: named references need their semicolon, as in browsers.
  for (const type of ['application/vnd.anima&plusxml', 'application&solvnd.anima+xml']) {
    const r = buildHTML(
      `<anima-icon><script type="${type}">${animl}</script></anima-icon>`,
      'p.html',
    );
    expect(r.text).toContain(type);
  }
});
