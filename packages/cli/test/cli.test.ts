import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DOC, markupName, type Shape, load, Player } from '@anima-format/core';
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

  it('compares same-size black-ink renders with a source SVG and reports failure', async () => {
    const source = join(ROOT, 'fixtures/glyphs/bell.svg');
    const generated = join(tmp, 'compare-bell.ani');
    await cli('new', 'bell', '--glyph', source, '-o', generated, '--force');
    const good = await cli('render', generated, '--compare', source, '--format=json');
    expect(good.code).toBe(0);
    expect(JSON.parse(good.out)).toMatchObject({
      differingPixels: 0,
      maxChannelDifference: 0,
      pass: true,
    });
    const bad = await cli(
      'render',
      BELL,
      '--compare',
      source,
      '--current',
      '#ff0000',
      '--format=json',
    );
    expect(bad.code).toBe(1);
    expect(JSON.parse(bad.out).differingPixels).toBeGreaterThan(0);
  });

  it('compares AniML frames, normalizes ink and viewport, and writes a tolerance diff', async () => {
    const source = join(ROOT, 'fixtures/glyphs/moon.svg');
    const generated = join(tmp, 'compare-moon.animl');
    expect((await cli('new', 'moon', '--glyph', source, '-o', generated, '--force')).code).toBe(0);
    const good = await cli(
      'render',
      generated,
      '--compare',
      source,
      '--current',
      '#ff0000',
      '--dark',
      '--format=json',
    );
    expect(good.code, good.err).toBe(0);
    expect(JSON.parse(good.out)).toMatchObject({ size: 256, pass: true, differingPixels: 0 });
    const diff = join(tmp, 'diff.png');
    const frame = await cli(
      'render',
      join(ROOT, 'examples/moon.animl'),
      '--compare',
      source,
      '-e',
      'toggle dark; advance 0',
      '--at',
      '0.3',
      '--size',
      '32',
      '-o',
      diff,
      '--format=json',
    );
    expect(frame.code, frame.err).toBe(1);
    expect(JSON.parse(frame.out)).toMatchObject({ size: 32, pass: false });
    expect(JSON.parse(frame.out).maxChannelDifference).toBeGreaterThan(0);
    const png = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><image width="32" height="32" href="data:image/png;base64,${readFileSync(diff).toString('base64')}"/></svg>`,
    ).render();
    expect(png.width).toBe(32);
    expect(png.height).toBe(32);
    const tolerated = await cli(
      'render',
      join(ROOT, 'examples/moon.animl'),
      '--compare',
      source,
      '-e',
      'toggle dark; advance 0',
      '--at',
      '0.3',
      '--size',
      '32',
      '--tolerance',
      '255',
      '--format=json',
    );
    expect(tolerated.code).toBe(0);
    expect(JSON.parse(tolerated.out)).toMatchObject({
      pass: true,
      pixelsBeyondTolerance: 0,
      differingPixels: JSON.parse(frame.out).differingPixels,
    });
    expect((await cli('render', generated, '--compare', source)).out).toContain(
      'PASS: 0 differing pixels',
    );
  });

  it.each([
    ['--tolerance', '-1'],
    ['--tolerance', '256'],
    ['--tolerance', 'NaN'],
    ['--tolerance', '0.5'],
    ['--size', '0'],
    ['--size', 'NaN'],
    ['--sheet', '2'],
    ['-o', 'diff.svg'],
  ])('rejects invalid compare options %s %s', async (flag, value) => {
    expect(
      (await cli('render', BELL, '--compare', join(ROOT, 'fixtures/glyphs/bell.svg'), flag, value))
        .code,
    ).toBe(2);
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
    expect(s.glyphs.bell.subpaths.length).toBeGreaterThan(0);
    expect(s.glyphs.bell.subpaths[0]).toHaveProperty('bbox');
    const text = (await cli('inspect', BELL)).out;
    expect(text).toMatch(/ringing: play ring, emit rang/);
    expect(text).toContain('glyphs (bbox:');
    expect(text).toContain('likely hole of 0');
  });

  it('schema marks gradient and dash keys with their module', async () => {
    const data = JSON.parse((await cli('schema', 'stroke', '--format=json')).out);
    for (const name of ['type', 'stops', 'dash', 'dashOffset'])
      expect(data.fields.find((f: { ani: string }) => f.ani === name).feature).toBe('paint');
    expect((await cli('schema', 'stroke')).out).toContain(
      'stroke-dasharray ↔ stroke.dash: array<number | string> [paint]',
    );
  });

  it('schema exposes composite objects and SVG spellings', async () => {
    for (const topic of ['mask', 'clip', 'drawOrder', 'paints']) {
      const result = await cli('schema', topic, '--format=json');
      expect(result.code).toBe(0);
      const data = JSON.parse(result.out);
      expect(data.fields.length).toBeGreaterThan(0);
    }
    const stroke = JSON.parse((await cli('schema', 'stroke', '--format=json')).out);
    expect(stroke.fields).toContainEqual(
      expect.objectContaining({ ani: 'position', markup: 'stroke-position', feature: 'composite' }),
    );
    expect((await cli('schema', 'rect')).out).toContain('mix-blend-mode');
  });

  it('schema describes node types and paint', async () => {
    expect((await cli('schema', 'circle')).out).toMatch(/r +number/);
    expect(
      JSON.parse((await cli('schema', 'stroke', '--format=json')).out).stroke.map(
        (p: { name: string }) => p.name,
      ),
    ).toContain('trimEnd');
    expect(JSON.parse((await cli('schema', '--json-schema')).out).$defs.node).toBeDefined();
    expect((await cli('schema', 'ellipse')).code).toBe(0);
    for (const type of ['ellipse', 'polygon', 'star', 'triangle', 'rect', 'path'])
      expect((await cli('schema', type)).out).toContain('paint');
  });

  it.each([
    ['a11y', ['a11y']],
    ['transition', ['machine', 'layers', '*', 'states', '*', 'on', '*']],
    ['listener', ['listeners', '*']],
    ['input', ['inputs', '*']],
  ] as const)(
    'schema %s lists every registry field with both spellings and types',
    async (topic, path) => {
      let shape: Shape = DOC;
      for (const key of path) {
        if (shape.k === 'obj') shape = shape.p[key]!;
        else if (shape.k === 'map' || shape.k === 'arr') shape = shape.of;
      }
      if (shape.k !== 'obj') throw new Error('expected an object registry');
      const json = await cli('schema', topic, '--format=json');
      expect(json.code).toBe(0);
      const fields = JSON.parse(json.out).fields;
      expect(fields.map((f: { ani: string }) => f.ani)).toEqual(Object.keys(shape.p));
      const text = await cli('schema', topic);
      expect(text.code).toBe(0);
      for (const [key, value] of Object.entries(shape.p)) {
        const field = fields.find((f: { ani: string }) => f.ani === key);
        expect(field.markup).toBe(markupName(value, key));
        expect(field.type.length).toBeGreaterThan(0);
        expect(field.required).toBe(shape.req?.includes(key) ?? false);
        expect(text.out).toContain(`${field.markup} ↔ ${key}: ${field.type}`);
      }
      if (topic === 'transition')
        expect(fields.find((f: { ani: string }) => f.ani === 'blend')).toMatchObject({
          type: 'number',
          min: 0,
        });
      if (topic === 'input')
        expect(fields.find((f: { ani: string }) => f.ani === 'type')).toMatchObject({
          markup: 'element name',
          type: '"bool" | "number" | "trigger"',
        });
      expect((await cli('--help')).out).toContain(topic);
    },
  );

  it('docs serves the authoring guide, its sections and the spec', async () => {
    expect((await cli('docs')).out).toMatch(/^# Authoring/);
    expect((await cli('docs', 'spec')).out).toMatch(/^# The `.ani` format/);
    const topics = (await cli('docs', '--list')).out.split('\n');
    expect(topics.length).toBeGreaterThan(5);
    expect((await cli('docs', topics[2]!)).out).toMatch(/^## /);
  });
});
