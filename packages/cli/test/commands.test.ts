import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { run } from '../src/cli.ts';
import { comparePNG } from '../src/compare-png.ts';
import { findProject } from '../src/project.ts';
import { mixAudio } from '../src/audio.ts';
import { load } from '@anima-format/core';
const dirs: string[] = [];
const temp = () => {
  const d = mkdtempSync(resolve(tmpdir(), 'anima-commands-'));
  dirs.push(d);
  return d;
};
const invoke = async (args: string[]) => {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out, err };
};
const root = resolve(import.meta.dirname, '../../..');
const bell = resolve(root, 'examples/bell.animl');
const fixture = (fill = '#ff0000') =>
  `<anima version="0.1" name="test" grid="10"><rect id="r" x0="0" y0="0" width="10" height="10" fill="${fill}"/></anima>`;
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
describe('P3b CLI commands', () => {
  it('compares raw RGBA, means, tolerance and diff dimensions', async () => {
    const d = temp(),
      a = new PNG({ width: 2, height: 1 }),
      b = new PNG({ width: 2, height: 1 });
    a.data.set([0, 0, 0, 0, 1, 2, 3, 255]);
    b.data.set([0, 0, 0, 1, 3, 2, 3, 255]);
    const aa = PNG.sync.write(a),
      bb = PNG.sync.write(b);
    writeFileSync(resolve(d, 'a.png'), aa);
    writeFileSync(resolve(d, 'b.png'), bb);
    expect(comparePNG(aa, bb, 2, true)).toMatchObject({
      pass: true,
      differingPixels: 2,
      maxChannelDifference: 2,
      meanChannelDifference: 3 / 8,
    });
    expect(
      (
        await invoke([
          'compare',
          resolve(d, 'a.png'),
          resolve(d, 'b.png'),
          '--tolerance',
          '1',
          '-o',
          resolve(d, 'diff.png'),
        ])
      ).code,
    ).toBe(1);
    expect(PNG.sync.read(readFileSync(resolve(d, 'diff.png'))).width).toBe(2);
    expect(
      (await invoke(['compare', resolve(d, 'a.png'), resolve(d, 'b.png'), '--tolerance', '2']))
        .code,
    ).toBe(0);
    expect((await invoke(['compare', 'a.png'])).code).toBe(2);
    expect((await invoke(['compare', 'a.png', 'b.png', '--tolerance', '256'])).code).toBe(2);
    expect((await invoke(['compare', 'missing.png', 'missing2.png'])).code).toBe(1);
  });
  it('renders viewport/fit/scale and probes final pixels', async () => {
    const d = temp(),
      f = resolve(d, 'test.animl');
    writeFileSync(f, fixture());
    const r = await invoke([
      'render',
      f,
      '--viewport',
      '20x10',
      '--scale',
      '0.5',
      '--fit',
      'contain',
      '--probe',
      '0,0;5,2',
      '-o',
      resolve(d, 'out.png'),
    ]);
    expect(r.code, r.err.join('\n')).toBe(0);
    const p = JSON.parse(r.out[0]!);
    expect(p.probes).toEqual([
      { x: 0, y: 0, rgba: [0, 0, 0, 0] },
      { x: 5, y: 2, rgba: [255, 0, 0, 255] },
    ]);
    const image = PNG.sync.read(readFileSync(resolve(d, 'out.png')));
    expect([image.width, image.height]).toEqual([10, 5]);
    for (const fit of ['cover', 'fill', 'none'])
      expect(
        (await invoke(['render', f, '--viewport', '20x10', '--fit', fit, '--probe', '0,0'])).code,
      ).toBe(0);
    for (const args of [
      ['--scale', '2'],
      ['--scale', '0'],
      ['--viewport', '0x10'],
      ['--fit', 'bad'],
      ['--probe', '10,0'],
      ['--probe', 'x,y'],
      ['--at', 'NaN'],
    ])
      expect((await invoke(['render', f, '--size', '10', '--probe', '0,0', ...args])).code).toBe(2);
  });
  it('selects a component as the root', async () => {
    const d = temp(),
      f = resolve(d, 'test.animl');
    writeFileSync(
      f,
      `<anima version="0.1" name="test" grid="10" requires="components"><component name="red" grid="10"><rect id="r" x0="0" y0="0" width="10" height="10" fill="#ff0000"/></component><rect id="blue" x0="0" y0="0" width="10" height="10" fill="#0000ff"/></anima>`,
    );
    const r = await invoke(['render', f, '--component', 'red', '--size', '10', '--probe', '5,5']);
    expect(r.code, r.err.join('\n')).toBe(0);
    expect(JSON.parse(r.out[0]!).probes[0].rgba).toEqual([255, 0, 0, 255]);
    expect((await invoke(['render', f, '--component', 'missing', '--probe', '0,0'])).code).toBe(2);
  });
  it('searches deterministically across types, fields and diagnostic codes and looks up fields', async () => {
    const args = ['schema', '--search', 'width', '--format=json'];
    const a = await invoke(args);
    expect(a.code).toBe(0);
    expect(a.out).toEqual((await invoke(args)).out);
    expect(
      JSON.parse(a.out[0]!).results.some((x: { name: string }) => x.name === 'rect.width'),
    ).toBe(true);
    expect(
      JSON.parse((await invoke(['schema', '--search', 'unknown-input', '--format=json'])).out[0]!)
        .results[0].kind,
    ).toBe('diagnostic');
    expect(JSON.parse((await invoke(['schema', 'rect.width', '--format=json'])).out[0]!).ani).toBe(
      'w',
    );
    expect((await invoke(['schema', 'rect.missing'])).code).toBe(2);
  });
  it('reports inspect wiring and doctor checks', async () => {
    const r = await invoke(['inspect', bell, '--summary', '--format=json']);
    expect(r.code).toBe(0);
    expect(Array.isArray(JSON.parse(r.out[0]!).wiring)).toBe(true);
    const previous = process.env.CHROMIUM_PATH;
    process.env.CHROMIUM_PATH = '/missing-browser';
    try {
      const d = await invoke(['doctor', '--format=json']);
      expect(d.code).toBe(1);
      expect(
        JSON.parse(d.out[0]!).checks.find((c: { name: string }) => c.name === 'chromium'),
      ).toMatchObject({ pass: false });
    } finally {
      if (previous === undefined) delete process.env.CHROMIUM_PATH;
      else process.env.CHROMIUM_PATH = previous;
    }
  }, 20000);
  it('discovers projects upward, merges sources and gives explicit flags precedence', async () => {
    const d = temp(),
      old = process.cwd();
    writeFileSync(
      resolve(d, 'main.animl'),
      '<anima version="0.1" name="test" grid="10" requires="components"><instance id="root" component="shapes:red"/></anima>',
    );
    writeFileSync(
      resolve(d, 'shapes.animl'),
      '<library name="shapes"><component name="red" grid="10"><rect id="r" x0="0" y0="0" width="10" height="10" fill="#ff0000"/></component></library>',
    );
    writeFileSync(
      resolve(d, 'anima.json'),
      JSON.stringify({
        entry: 'main.animl',
        sources: ['shapes.animl'],
        presets: { small: { size: 10, fit: 'fill' } },
      }),
    );
    mkdirSync(resolve(d, 'child'));
    try {
      process.chdir(resolve(d, 'child'));
      expect(findProject()?.entry).toBe(resolve(d, 'main.animl'));
      expect((await invoke(['validate'])).code).toBe(0);
      const r = await invoke(['render', '--preset', 'small', '--size', '20', '--probe', '19,19']);
      expect(r.code, r.err.join('\n')).toBe(0);
      expect(JSON.parse(r.out[0]!).probes[0].rgba).toEqual([255, 0, 0, 255]);
      expect((await invoke(['render', '--preset', 'missing', '--probe', '0,0'])).code).toBe(2);
      writeFileSync(resolve(d, 'anima.json'), '{');
      expect((await invoke(['validate', '--format=json'])).code).toBe(1);
    } finally {
      process.chdir(old);
    }
  });
  for (const sample of ['bell', 'moon', 'progress'])
    it('copies and validates sample ' + sample, async () => {
      const d = resolve(temp(), 'sample');
      expect((await invoke(['new', d, '--sample', sample])).code).toBe(0);
      expect((await invoke(['validate', resolve(d, 'main.animl')])).code).toBe(0);
      expect(existsSync(resolve(d, 'anima.json'))).toBe(true);
      expect((await invoke(['new', d, '--sample', sample])).code).toBe(1);
    });
  it('exports compiled JSON and an HTML page with a runtime', async () => {
    const d = temp();
    const r = await invoke(['build', bell, '--out-dir', d, '--format=json']);
    expect(r.code, r.err.join('\n')).toBe(0);
    expect(load(readFileSync(resolve(d, 'bell.ani'), 'utf8')).model).toBeDefined();
    expect(readFileSync(resolve(d, 'index.html'), 'utf8')).toContain('application/vnd.anima+json');
    expect(readFileSync(resolve(d, 'anima.js'), 'utf8').length).toBeGreaterThan(1000);
  }, 20000);
  it('reports missing audio browser as a diagnostic', async () => {
    const previous = process.env.CHROMIUM_PATH;
    process.env.CHROMIUM_PATH = '/missing-browser';
    try {
      const r = await invoke([
        'render',
        bell,
        '--audio',
        resolve(temp(), 'out.wav'),
        '--format=json',
      ]);
      expect(r.code).toBe(1);
      expect(JSON.parse(r.out[0]!).diagnostics[0]).toMatchObject({
        code: 'build-encoder-unavailable',
        pointer: '',
        hint: expect.any(String),
      });
    } finally {
      if (previous === undefined) delete process.env.CHROMIUM_PATH;
      else process.env.CHROMIUM_PATH = previous;
    }
  });
  const browser =
    process.env.CHROMIUM_PATH ??
    resolve(
      homedir(),
      '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    );
  it.skipIf(!existsSync(browser))(
    'mixes audio through Chromium into PCM WAV',
    async () => {
      const model = load({
        ...JSON.parse(readFileSync(resolve(root, 'examples/bell.ani'), 'utf8')),
        assets: {
          tone: { type: 'audio', source: 'data:audio/wav;base64,' + wav().toString('base64') },
        },
        requires: ['assets'],
      }).model!;
      expect(model).toBeDefined();
      const bytes = await mixAudio(
        model,
        [{ name: 'sound', audio: 'tone', time: 0, layer: null, volume: 0.5 }],
        0.1,
        bell,
      );
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.length).toBe(19244);
      expect(Math.abs(bytes.readInt16LE(44 + 400))).toBeGreaterThan(1000);
    },
    20000,
  );
});
function wav() {
  const b = Buffer.alloc(44 + 1600);
  b.write('RIFF');
  b.writeUInt32LE(1636, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(1600, 40);
  for (let i = 0; i < 800; i++) b.writeInt16LE(16000, 44 + i * 2);
  return b;
}

it.each([
  { entry: 3 },
  { sources: ['bad.ani'] },
  { presets: [] },
  { presets: { bad: { audio: 'out.wav' } } },
  { presets: { bad: { dark: 'true' } } },
  { unknown: true },
  [],
])('rejects malformed project configuration %j', async (config) => {
  const d = temp();
  writeFileSync(resolve(d, 'anima.json'), JSON.stringify(config));
  expect(() => findProject(d)).toThrow();
});

it('reports each static wiring category with a pointer and hint', async () => {
  const { wiringSummary } = await import('../src/inspect-summary.ts');
  const result = wiringSummary(
    {
      doc: {
        inputs: { unused: { type: 'bool' } },
        components: { orphan: {} },
        machine: { layers: { main: { initial: 'start', states: { start: {}, lost: {} } } } },
        data: {
          model: 'Selected',
          models: {
            Selected: { properties: {} },
            Unused: { properties: { value: { type: 'number' } } },
          },
        },
        listeners: [{ target: 'missing' }],
      },
      nodes: [],
    } as unknown as import('@anima-format/core').Model,
    [{ code: 'unused-input', severity: 'warning', pointer: '/inputs/unused', message: 'unused' }],
  );
  expect(result.map((d) => d.code)).toEqual([
    'unbound-input',
    'unused-component',
    'unreachable-state',
    'unused-model',
    'unused-property',
    'listener-target',
  ]);
  for (const finding of result) {
    expect(finding.pointer).toMatch(/^\//);
    expect(finding.hint.length).toBeGreaterThan(0);
  }
});

describe('D-A discovery command dispatch', () => {
  const feature = {
    entry: {
      kind: 'feature' as const,
      name: 'paint',
      summary: 'paint fills and strokes',
      docs: ['paint'],
      examples: ['examples/paint.animl'],
    },
    provides: [
      {
        kind: 'element' as const,
        name: 'fill',
        summary: 'fill paint',
        feature: 'paint',
        docs: ['paint'],
      },
      { kind: 'field' as const, name: 'fill.color', summary: 'fill colour', feature: 'paint' },
    ],
    after: ['core'],
  };
  const hit = { entry: feature.provides[0]!, score: 10 };
  const example = {
    entry: {
      kind: 'example' as const,
      name: 'examples/bell.animl',
      summary: 'interactive bell',
      feature: 'paint',
    },
    path: 'examples/bell.animl',
    requires: ['paint'],
  };
  const discovery = {
    features: (name?: string) => (name ? (name === 'paint' ? feature : undefined) : [feature]),
    search: () => [hit],
    examples: () => [example],
  };
  const call = async (...args: string[]) => {
    const out: string[] = [],
      err: string[] = [];
    const code = await run(
      args,
      {
        out: (text) => out.push(text),
        err: (text) => err.push(text),
        write: (text) => out.push(text),
      },
      { discover: discovery },
    );
    return { code, out: out.join('\n'), err: err.join('\n') };
  };

  it('lists features and groups one feature by provided kind', async () => {
    expect((await call('features')).out).toContain('paint — paint fills and strokes');
    const one = await call('features', 'paint');
    expect(one.code).toBe(0);
    expect(one.out).toContain('element:');
    expect(one.out).toContain('field:');
    expect(one.out).toContain('Docs: paint');
    expect(one.out).toContain('Examples: examples/paint.animl');
    expect(one.out).toContain('After: core');
  });

  it('searches the injected index and gives a next action', async () => {
    const result = await call('search', 'fill', '--kind', 'element', '--limit', '5');
    expect(result.code).toBe(0);
    expect(result.out).toContain('element  fill  fill paint');
    expect(result.out).toContain('Next:');
  });

  it('lists, prints, and copies one injected example', async () => {
    expect((await call('examples', 'bell')).out).toContain(
      'examples/bell.animl — interactive bell (requires paint)',
    );
    expect((await call('examples', 'bell', '--print')).out).toContain('<anima');
    const dir = temp();
    const copied = await call('examples', 'bell', '-o', dir);
    expect(copied.code).toBe(0);
    expect(existsSync(resolve(dir, 'bell.animl'))).toBe(true);
  });

  it('rejects command-specific flags and emits JSON usage errors', async () => {
    const bad = await call('validate', bell, '--size', '10', '--format=json');
    expect(bad.code).toBe(2);
    expect(JSON.parse(bad.err)).toMatchObject({
      error: expect.stringContaining('--size'),
      suggestions: expect.any(Array),
      help: 'anima help validate',
    });
  });

  it('supports command aliases, version, and typo suggestions', async () => {
    expect((await call('check', bell)).code).toBe(0);
    expect((await call('version')).out).toBe('0.1.0');
    expect((await call('rendr')).err).toContain('render');
    expect((await call('render', bell, '--sze', '4')).err).toContain('--size');
    expect((await call('render', bell, '--fit', 'covr')).err).toContain('cover');
    expect((await call('library', 'updte')).err).toContain('update');
  });
});
