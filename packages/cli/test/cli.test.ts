import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load, Player } from '@anima-format/core';
import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { run } from '../src/index.ts';
import { compareWithRive } from '../src/compare.ts';
import { LIGHT, frameSVG } from '../src/render.ts';

const ROOT = new URL('../../../', import.meta.url).pathname;
const BELL = join(ROOT, 'examples/bell.ani');
const tmp = mkdtempSync(join(tmpdir(), 'anima-cli-'));

async function cli(...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(argv, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('anima validate', () => {
  it('accepts the bell', async () => {
    const r = await cli('validate', BELL);
    expect(r.code).toBe(0);
    expect(r.out).toBe(`${BELL}: ok`);
  });

  it('reports errors with line, column, pointer and hint', async () => {
    const f = join(tmp, 'typo.ani');
    writeFileSync(
      f,
      readFileSync(BELL, 'utf8')
        .replace('"rotate": 0', '"rotate": 0')
        .replace('"pivot": [10, 2.5]', '"pivot": [10, 2.5],\n          "rotation": 3'),
    );
    const r = await cli('validate', f, '--format=json');
    expect(r.code).toBe(1);
    const d = JSON.parse(r.out).diagnostics[0];
    expect(d).toMatchObject({
      code: 'unknown-key',
      pointer: '/nodes/0/children/1/rotation',
      hint: 'did you mean "rotate"?',
    });
    expect(d.line).toBeGreaterThan(100);
    const text = await cli('validate', f);
    expect(text.err).toMatch(
      /typo\.ani:\d+:\d+ error unknown-key \/nodes\/0\/children\/1\/rotation: unknown key "rotation" — did you mean "rotate"\?/,
    );
  });

  it('finds duplicate keys (duplicate-key)', async () => {
    const f = join(tmp, 'dup.ani');
    writeFileSync(
      f,
      readFileSync(BELL, 'utf8').replace(
        '"title": "Bell",',
        '"title": "Bell",\n  "title": "Bell 2",',
      ),
    );
    const r = await cli('validate', f, '--format=json');
    expect(r.code).toBe(1);
    expect(JSON.parse(r.out).diagnostics[0]).toMatchObject({
      code: 'duplicate-key',
      pointer: '/title',
      line: 5,
    });
  });

  it('warns when a glyph changed since its hash (hash-mismatch)', async () => {
    const f = join(tmp, 'hash.ani');
    writeFileSync(f, readFileSync(BELL, 'utf8').replace('"M9.493 4.473', '"M9.494 4.473'));
    const r = await cli('validate', f, '--format=json');
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).diagnostics).toMatchObject([
      { code: 'hash-mismatch', severity: 'warning', pointer: '/glyphs/bell/sha256' },
    ]);
  });

  it('reports JSON syntax errors with a position', async () => {
    const f = join(tmp, 'broken.ani');
    writeFileSync(f, '{\n  "anima": "0.1",\n  "name": \n}');
    const r = await cli('validate', f, '--format=json');
    expect(r.code).toBe(1);
    expect(JSON.parse(r.out).diagnostics[0]).toMatchObject({ code: 'json-syntax', line: 4 });
  });

  it('usage errors exit 2', async () => {
    expect((await cli('validate')).code).toBe(2);
    expect((await cli('frobnicate')).code).toBe(2);
    expect((await cli('validate', '/no/such/file')).code).toBe(2);
  });
});

describe('anima sample', () => {
  it('runs a conformance script and prints its expected snapshots', async () => {
    const dir = join(ROOT, 'spec/conformance/crossfade');
    const r = await cli('sample', join(dir, 'case.ani'), '--script', join(dir, 'script.txt'));
    expect(r.code).toBe(0);
    const want = readFileSync(join(dir, 'expected.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    const got = r.out.split('\n').map((l) => JSON.parse(l));
    got.forEach((g, i) => expect(g.values['a.x']).toBeCloseTo(want[i].values['a.x'], 6));
  });

  it('takes inline scripts and reports script errors by line', async () => {
    const r = await cli(
      'sample',
      BELL,
      '-e',
      'fire ring; advance 0; advance 0.1166667; snapshot swing.rotate',
    );
    expect(JSON.parse(r.out).values['swing.rotate']).toBeCloseTo(17.1887, 3);
    const bad = await cli('sample', BELL, '-e', 'fire rnig');
    expect(bad.code).toBe(1);
    expect(bad.err).toMatch(/line 1: no input "rnig"/);
  });
});

describe('anima render', () => {
  it('writes SVG, PNG and contact sheets', async () => {
    for (const [out, extra] of [
      ['f.svg', []],
      ['f.png', ['--dark', '-e', 'fire ring', '--at', '0.2']],
      ['s.png', ['--sheet', '6', '-e', 'fire ring']],
    ] as const) {
      const r = await cli('render', BELL, '-o', join(tmp, out), ...extra);
      expect(r.code, r.err).toBe(0);
      const bytes = readFileSync(join(tmp, out));
      if (out.endsWith('.png')) expect(bytes.subarray(1, 4).toString()).toBe('PNG');
      else expect(bytes.toString()).toMatch(/^<svg /);
    }
  });

  it('matches the Rive reference frames', async () => {
    for (const [frame, , diff] of await compareWithRive()) expect(diff, frame).toBeLessThan(4);
  });
});

describe('anima fmt', () => {
  it('is canonical and stable on the bell, and keeps meaning', async () => {
    expect((await cli('fmt', BELL, '--check')).code).toBe(0);
    const f = join(tmp, 'shuffled.ani');
    const doc = JSON.parse(readFileSync(BELL, 'utf8'));
    const shuffled = Object.fromEntries(Object.entries(doc).reverse());
    writeFileSync(f, JSON.stringify(shuffled));
    expect((await cli('fmt', f, '--check')).code).toBe(1);
    expect((await cli('fmt', f, '--write')).code).toBe(0);
    expect(readFileSync(f, 'utf8')).toBe(readFileSync(BELL, 'utf8'));
  });
});

describe('anima new', () => {
  const glyphs = readdirSync(join(ROOT, 'fixtures/glyphs')).filter((g) => g.endsWith('.svg'));

  it.each(glyphs)('%s: the rest frame is pixel-identical to the glyph SVG', async (g) => {
    const name = g.replace('.svg', '');
    const out = join(tmp, `${name}.ani`);
    const r = await cli(
      'new',
      name,
      '--glyph',
      join(ROOT, 'fixtures/glyphs', g),
      '-o',
      out,
      '--force',
    );
    expect(r.code, r.err).toBe(0);
    expect((await cli('validate', out)).code).toBe(0);
    const p = new Player(load(readFileSync(out, 'utf8')).model!);
    p.step(0);
    const source = readFileSync(join(ROOT, 'fixtures/glyphs', g), 'utf8').replace(
      '<svg ',
      `<svg color="${LIGHT.color}" `,
    );
    for (const px of [16, 20, 48, 200]) {
      const a = new Resvg(frameSVG(p, LIGHT), { fitTo: { mode: 'width', value: px } }).render()
        .pixels;
      const b = new Resvg(source, { fitTo: { mode: 'width', value: px } }).render().pixels;
      expect(Buffer.compare(Buffer.from(a), Buffer.from(b)), `${name} at ${px}px`).toBe(0);
    }
  });

  it('reads a Glyphy project and carries its metadata', async () => {
    const out = join(tmp, 'bell-g.ani');
    const r = await cli(
      'new',
      'bell',
      '--glyphy',
      join(ROOT, 'fixtures'),
      '-o',
      out,
      '--format=json',
    );
    expect(r.code, r.err).toBe(0);
    const doc = JSON.parse(readFileSync(out, 'utf8'));
    expect(doc.meta.glyphy).toEqual({
      concept: 'a notification bell with a small clapper arc below',
      kind: 'icon',
      stroke: 1,
    });
    expect(doc.glyphs.bell).toMatchObject({
      source: 'glyphy',
      pick: 'bell-1',
      sha256: JSON.parse(readFileSync(BELL, 'utf8')).glyphs.bell.sha256,
    });
  });

  it('refuses bad names and overwrites', async () => {
    expect(
      (await cli('new', 'bell-2', '--glyph', join(ROOT, 'fixtures/glyphs/bell.svg'))).code,
    ).toBe(2);
    const out = join(tmp, 'exists.ani');
    writeFileSync(out, '{}');
    expect(
      (await cli('new', 'bell', '--glyph', join(ROOT, 'fixtures/glyphs/bell.svg'), '-o', out)).code,
    ).toBe(1);
  });
});

describe('anima inspect, schema, docs', () => {
  it('inspect summarises the bell', async () => {
    const r = await cli('inspect', BELL, '--format=json');
    const s = JSON.parse(r.out);
    expect(s.layers.map((l: { name: string }) => l.name)).toEqual(['ring', 'hover']);
    expect(s.overlaps).toEqual([]);
    expect((await cli('inspect', BELL)).out).toMatch(/ringing: play ring, emit rang/);
  });

  it('schema describes node types and paint', async () => {
    expect((await cli('schema', 'circle')).out).toMatch(/r +number/);
    expect(
      JSON.parse((await cli('schema', 'stroke', '--format=json')).out).stroke.map(
        (p: { name: string }) => p.name,
      ),
    ).toContain('trimEnd');
    expect(JSON.parse((await cli('schema', '--json-schema')).out).$defs.node).toBeDefined();
    expect((await cli('schema', 'ellipse')).code).toBe(2);
  });

  it('docs serves the authoring guide, its sections and the spec', async () => {
    expect((await cli('docs')).out).toMatch(/^# Authoring/);
    expect((await cli('docs', 'spec')).out).toMatch(/^# The `.ani` format/);
    const topics = (await cli('docs', '--list')).out.split('\n');
    expect(topics.length).toBeGreaterThan(5);
    expect((await cli('docs', topics[2]!)).out).toMatch(/^## /);
  });
});
