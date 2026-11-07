import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { run } from '../src/cli.ts';
import { findProject, substituteConstants } from '../src/project.ts';
import { bench } from '../src/bench.ts';
import { compile } from '@anima-format/markup';
import { load } from '@anima-format/core';
import { runScript } from '../../core/src/script.ts';
const cwd = process.cwd();
const dirs: string[] = [];
afterEach(() => {
  process.chdir(cwd);
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const temp = () => {
  const d = mkdtempSync(resolve(tmpdir(), 'p3c-tooling-'));
  dirs.push(d);
  return d;
};
const invoke = async (...args: string[]) => {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out, err };
};
const source =
  '<anima version="0.1" name="test" grid="20" requires="a11y focus"><bool name="on"/><circle id="dot" cx="10" cy="10" r="2" fill="#000"><a11y role="checkbox" label="Dot" checked="on"/></circle></anima>';
const model = () => load(compile(source).doc!).model!;
it('reports measured JS heap growth and per-frame slope', () => {
  const result = bench(model, '', 3)!;
  expect(result).toHaveProperty('memory.kind', 'js-heap');
  if (!result.memory) throw Error('missing memory');
  expect(result.memory.growthBytes).toBe(result.memory.afterBytes - result.memory.beforeBytes);
  expect(result.memory.bytesPerFrame).toBe(result.memory.growthBytes / 3);
});
it('groups assertions and consumes errors only on the next command', () => {
  expect(
    runScript(
      model(),
      'group visible\nexpect-error script-target\nset absent true\nexpect-error script-expect\nexpect on == true\nend',
    ).diagnostics,
  ).toEqual([]);
  expect(runScript(model(), 'expect-error script-target\nsnapshot').diagnostics[0]).toMatchObject({
    code: 'script-expect-error',
    pointer: '/script/1',
    hint: expect.any(String),
  });
  expect(
    runScript(model(), 'expect-error other\nset absent true').diagnostics[0]?.message,
  ).toContain('received script-target');
  expect(() => runScript(model(), 'end')).toThrow('open group');
});
it('diagnoses absent inputs and hidden or absent semantic targets', () => {
  for (const command of [
    'set missing true',
    'fire missing',
    'toggle missing',
    'semantic missing tap',
  ]) {
    try {
      runScript(model(), command);
      throw Error('missing error');
    } catch (e) {
      expect(e).toMatchObject({
        code: 'script-target',
        pointer: '/script/0',
        hint: expect.any(String),
      });
    }
  }
  const doc = structuredClone(model().doc);
  doc.nodes[0]!.visible = false;
  expect(
    runScript(load(doc).model!, 'expect-error script-target\nsemantic dot tap').diagnostics,
  ).toEqual([]);
  expect(runScript(model(), 'semantic dot tap\nsnapshot --all').snapshots[0]?.values.on).toBe(true);
});
it('substitutes constants only in attributes and escapes XML without corrupting ranges', () => {
  const text = '<anima name="{{name}} &amp; end" title="{{name}}">{{name}}</anima>';
  expect(substituteConstants(text, { name: 'A&"<' })).toBe(
    '<anima name="A&amp;&quot;&lt; &amp; end" title="A&amp;&quot;&lt;">{{name}}</anima>',
  );
  expect(() => substituteConstants('<anima name="{{missing}}"/>', {})).toThrow(
    'unknown build constant',
  );
});
it('validates project scalars and excludes test libraries from build', async () => {
  const d = temp();
  process.chdir(d);
  writeFileSync(
    'anima.json',
    JSON.stringify({
      entry: 'main.animl',
      sources: ['test.animl'],
      exclude: ['**/test.animl'],
      constants: { radius: 3 },
    }),
  );
  writeFileSync('test.animl', 'INVALID TEST ONLY');
  writeFileSync(
    'main.animl',
    '<anima version="0.1" name="constants" grid="20"><circle id="dot" cx="10" cy="10" r="{{radius}}" fill="#000"/></anima>',
  );
  expect(findProject()?.sources).toEqual([]);
  const result = await invoke('build', '-o', 'out.ani', '--format=json');
  expect(result.code, result.err.join('\n')).toBe(0);
  expect(JSON.parse(readFileSync('out.ani', 'utf8')).nodes[0].r).toBe(3);
  for (const config of [
    { exclude: [42] },
    { constants: [] },
    { constants: { x: {} } },
    { constants: { 'bad/name': 1 } },
  ]) {
    writeFileSync('anima.json', JSON.stringify(config));
    expect(() => findProject()).toThrow();
  }
});
it('filters inherited animatable/bindable schema and reports editor N/A', async () => {
  const result = await invoke(
    'schema',
    'circle',
    '--animatable',
    '--bindable',
    '--inherited',
    '--format=json',
  );
  expect(result.code).toBe(0);
  const fields = JSON.parse(result.out[0]!).fields;
  expect(fields.some((f: { ani: string }) => f.ani === 'x')).toBe(true);
  expect(fields.some((f: { ani: string }) => f.ani === 'r')).toBe(false);
  expect(
    JSON.parse((await invoke('schema', '--editor-only', '--format=json')).out[0]!).applicable,
  ).toBe(false);
});
it('lists spec chapters and pages the authoring guide', async () => {
  const chapters = JSON.parse((await invoke('docs', 'spec', '--list', '--format=json')).out[0]!);
  expect(chapters.length).toBeGreaterThan(10);
  const guide = (await invoke('docs', 'authoring')).out[0]!;
  expect(guide).toContain('Contents');
  const slug = /^- ([\w-]+):/m.exec(guide)![1]!;
  expect((await invoke('docs', 'authoring', slug)).out[0]).toMatch(/^## /);
});
it('renders sequential preset queues with numbered PNG sequences and WebM', async () => {
  const d = temp();
  process.chdir(d);
  writeFileSync('main.animl', source);
  writeFileSync(
    'anima.json',
    JSON.stringify({
      entry: 'main.animl',
      presets: { a: { frames: 2, size: 20, fps: 30 }, b: { frames: 1, size: 10 } },
    }),
  );
  const result = await invoke(
    'render',
    '--preset',
    'a',
    '--preset',
    'b',
    '-o',
    'frame.png',
    '--format=json',
  );
  expect(result.code, result.err.join('\n')).toBe(0);
  expect(result.out).toHaveLength(2);
  expect(existsSync('frame-a-0001.png')).toBe(true);
  expect(existsSync('frame-b-0000.png')).toBe(true);
  const video = await invoke(
    'render',
    '--frames',
    '3',
    '--fps',
    '10',
    '-o',
    'clip.webm',
    '--format=json',
  );
  expect(video.code, video.err.join('\n')).toBe(0);
  expect(readFileSync('clip.webm').subarray(0, 4).toString('hex')).toBe('1a45dfa3');
  const old = process.env.CHROMIUM_PATH;
  process.env.CHROMIUM_PATH = '/missing/encoder';
  try {
    const missing = await invoke('render', '--frames', '1', '-o', 'bad.webm', '--format=json');
    expect(missing.code).toBe(1);
    expect(missing.out.join('')).toContain('build-encoder-unavailable');
    expect(existsSync('bad.webm')).toBe(false);
  } finally {
    if (old === undefined) delete process.env.CHROMIUM_PATH;
    else process.env.CHROMIUM_PATH = old;
  }
}, 30000);

it('executes the tab selection follows focus recipe', () => {
  const guide = readFileSync(resolve(cwd, 'modules/a11y/AUTHORING.md'), 'utf8');
  const recipe = /```xml\n(<anima[^]*?name="tabs"[^]*?)\n```/.exec(guide)![1]!;
  // Start at the tabs example, rather than a preceding fenced example.
  const xml = recipe.slice(recipe.lastIndexOf('<anima'));
  const c = compile(xml);
  expect(c.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const m = load(c.doc!);
  expect(m.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(
    runScript(
      m.model!,
      'semantic one focus\nkey down ArrowRight\nexpect second == true\nexpect first == false',
    ).diagnostics,
  ).toEqual([]);
});
it('diagnoses project and occupied playground port with device/auth checks', async () => {
  const { createServer } = await import('node:net');
  const { doctor } = await import('../src/doctor.ts');
  const d = temp();
  writeFileSync(resolve(d, 'anima.json'), '{"constants":[]}');
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(4519, '127.0.0.1', resolve));
  try {
    const result = await doctor(d);
    expect(result.checks.find((c) => c.name === 'port')).toMatchObject({
      pass: false,
      code: 'doctor-port',
      pointer: '/checks/port',
      hint: expect.any(String),
    });
    expect(result.checks.find((c) => c.name === 'project')?.pass).toBe(false);
    expect(result.checks.find((c) => c.name === 'devices')?.pass).toBe(true);
    expect(result.checks.find((c) => c.name === 'authentication')?.message).toContain(
      'not applicable',
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}, 30000);

it('substitutes constants in imported libraries and diagnoses missing commands/groups', async () => {
  const d = temp();
  process.chdir(d);
  writeFileSync(
    'anima.json',
    JSON.stringify({ entry: 'main.animl', sources: ['ui.animl'], constants: { radius: 4 } }),
  );
  writeFileSync(
    'ui.animl',
    '<library name="ui"><component name="dot" grid="20"><circle id="dot" cx="10" cy="10" r="{{radius}}" fill="#000"/></component></library>',
  );
  writeFileSync(
    'main.animl',
    '<anima version="0.1" name="imports" grid="20" requires="components"><instance id="dot" component="ui:dot"/></anima>',
  );
  const result = await invoke('build', '-o', 'out.ani', '--format=json');
  expect(result.code, result.err.join('\n')).toBe(0);
  expect(
    Object.values(
      JSON.parse(readFileSync('out.ani', 'utf8')).components as Record<
        string,
        { nodes: { r: number }[] }
      >,
    )[0]!.nodes[0]!.r,
  ).toBe(4);
  expect(() => runScript(model(), 'group open')).toThrow('unclosed group');
  expect(() => runScript(model(), 'expect-error script-target')).toThrow('following command');
  expect(
    runScript(model(), 'group named\nexpect on == true\nend').diagnostics[0]?.message,
  ).toContain('[named]');
});
