import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { load, runScript, Player } from '@anima-format/core';
import { createScriptSession, ScriptError } from '../../core/src/script.ts';
import { run } from '../src/cli.ts';

const root = new URL('../../../', import.meta.url).pathname;
const bell = join(root, 'examples/bell.ani');
const dir = mkdtempSync(join(tmpdir(), 'anima-tools-'));
const file = join(dir, 'data.ani');
const doc = {
  anima: '0.1',
  name: 'agent-tools',
  grid: 20,
  requires: ['data', 'input'],
  data: {
    models: {
      State: {
        properties: {
          count: { type: 'number', default: 0 },
          title: { type: 'string', default: 'hi' },
          enabled: { type: 'bool', default: false },
          color: { type: 'color', default: '#000000' },
        },
      },
    },
    model: 'State',
  },
  nodes: [
    { id: 'dot', type: 'circle', x: 10, y: 10, center: [0, 0], r: 3, fill: { color: '#000' } },
  ],
  listeners: [
    { on: 'down', target: 'dot', set: { $count: 5 } },
    { on: 'key-down', target: 'dot', key: 'Enter', set: { $count: 7 } },
    { on: 'scroll', target: 'dot', set: { $count: 9 } },
    { on: 'gamepad-button', target: 'dot', control: 0, set: { $count: 11 } },
  ],
};
writeFileSync(file, JSON.stringify(doc));
const model = () => {
  const result = load(doc);
  expect(result.diagnostics).toEqual([]);
  return result.model!;
};
async function cli(args: string[], input?: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, {
    out: (s) => out.push(s),
    err: (s) => err.push(s),
    ...(input
      ? {
          input: (async function* () {
            yield* input;
          })(),
        }
      : {}),
  });
  return { code, out, err };
}

describe('P3b script tools', () => {
  it('sets/dumps/filters/watches typed data through the public API', () => {
    const engine = createScriptSession(model());
    const result = engine.execute(
      'data watch $count $title\ndata set $count 3\ndata set $title "hello # world"\nadvance 0\ndata dump $count\nsnapshot\nsnapshot',
    );
    expect(result.output[0]).toEqual({ data: { $count: 3 } });
    expect(result.snapshots[0]!.data).toEqual({ $count: 3, $title: 'hello # world' });
    expect(result.snapshots[1]!.data).toEqual({});
    const typed = engine.execute(
      'data set $enabled true\ndata set $color "#ff0000"\nadvance 0\nexpect $enabled == true\nexpect $color == "#ff0000"',
    );
    expect(typed.diagnostics).toEqual([]);
    expect(engine.player.data.get('$default:enabled')).toBe(true);
    expect(engine.execute('data dump').output.length).toBe(1);
  });
  it('streams paths that changed and returned to their previous snapshot value', () => {
    const result = runScript(
      model(),
      'data watch $count\ndata set $count 3\nadvance 0\ndata set $count 0\nadvance 0\nsnapshot\nsnapshot',
    );
    expect(result.snapshots[0]!.data).toEqual({ $count: 0 });
    expect(result.snapshots[1]!.data).toEqual({});
  });
  it('distinguishes hex-looking comments from unquoted color values', () => {
    const result = runScript(
      model(),
      '#abc\nadvance 0 #def\ndata set $color #ff0000\nadvance 0\nexpect $color == "#ff0000"\nsnapshot $color #bad',
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.snapshots[0]!.values.$color).toBe('#ff0000');
  });
  it('edits enum, list and nested data through typed host handles', () => {
    const extended = structuredClone(doc) as typeof doc & {
      data: { models: Record<string, unknown> };
    };
    Object.assign(extended.data.models, {
      Child: { properties: { title: { type: 'string', default: 'child' } } },
    });
    Object.assign(extended.data.models.State.properties, {
      mood: { type: 'enum', values: ['calm', 'happy'] },
      items: { type: 'list', of: 'Child', default: [] },
      child: { type: 'model-ref', model: 'Child', default: {} },
    });
    const result = load(extended);
    expect(result.diagnostics).toEqual([]);
    const engine = createScriptSession(result.model!);
    engine.execute(
      'data set $mood "happy"\ndata set $items [{"title":"first"}]\ndata set $child.title "nested"\nadvance 0',
    );
    expect(engine.player.data.get('$default:mood')).toBe('happy');
    expect(engine.player.data.get('$default:items')).toHaveLength(1);
    expect(engine.execute('data dump $items.0.title').output).toEqual([
      { data: { '$items.0.title': 'first' } },
    ]);
    engine.execute('data set $items []\nadvance 0');
    expect(engine.execute('data dump $items').output).toEqual([
      { data: { $items: [], '$items.length': 0 } },
    ]);
    expect(engine.player.data.get('$default:child.title')).toBe('nested');
  });
  it('keeps assertion failures and continues with every comparison', () => {
    const result = runScript(
      model(),
      'expect dot.x == 10\nexpect dot.x != 11\nexpect dot.x < 11\nexpect dot.x > 9\nexpect dot.x ~ 10.0000001\nexpect dot.x == 0\nexpect $count > 1\nsnapshot',
    );
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'script-expect',
      pointer: '/script/5',
      hint: expect.any(String),
    });
    expect(result.snapshots).toHaveLength(1);
  });
  it('supports multiple touch ids, pointer drag, wheel, key and gamepad commands', () => {
    const engine = createScriptSession(model());
    engine.execute('touch down 1 10 10\ntouch down 2 10 10');
    expect(engine.player.input().contacts.size).toBe(2);
    engine.execute('touch move 1 11 10\ntouch up 1 11 10\ntouch up 2 10 10');
    expect(engine.player.input().contacts.size).toBe(0);
    expect(engine.player.data.get('$default:count')).toBe(5);
    engine.execute('pointer drag 10 10 11 11 in 3\nkey down Enter - dot\nkey up Enter - dot');
    expect(engine.player.data.get('$default:count')).toBe(7);
    engine.execute('scroll 10 10 0 1');
    expect(engine.player.data.get('$default:count')).toBe(9);
    engine.execute(
      'gamepads [{"index":0,"connected":true,"buttons":[{"value":1,"pressed":true}]}]',
    );
    expect(engine.player.data.get('$default:count')).toBe(11);
    engine.execute('gamepads []\nscroll-cancel\ncontact cancel 3');
  });
  it('halts before the writing step and can clear a breakpoint and resume', () => {
    const engine = createScriptSession(model());
    engine.execute('data break $count == 4\ndata set $count 4');
    const result = engine.execute('advance 0\nsnapshot');
    expect(result.stopped).toBe(true);
    expect(result.snapshots).toHaveLength(0);
    expect(result.diagnostics[0]).toMatchObject({
      code: 'script-breakpoint',
      writer: expect.any(Array),
    });
    expect(engine.player.time).toBe(0);
    expect(engine.player.data.get('$default:count')).toBe(0);
    engine.execute('data break clear\nadvance 0\nexpect $count == 4');
    expect(engine.player.data.get('$default:count')).toBe(4);
  });
  it('breaks on a pointer listener write without applying it live', () => {
    const engine = createScriptSession(model());
    engine.execute('data break $count');
    expect(engine.execute('pointer down 10 10').stopped).toBe(true);
    expect(engine.player.data.get('$default:count')).toBe(0);
    engine.execute('data break clear\nadvance 0');
    expect(engine.player.data.get('$default:count')).toBe(5);
  });
  it('includes unanimated values with --all; ordinary snapshots remain compatible', () => {
    expect(runScript(model(), 'snapshot').snapshots[0]!.values).toEqual({});
    const result = runScript(model(), 'snapshot --all');
    expect(result.snapshots[0]!.values).toMatchObject({
      'dot.x': 10,
      'dot.r': 3,
      'dot.fill.color': '#000000',
      $count: 0,
    });
    expect(runScript(model(), 'snapshot dot.x').snapshots[0]!.values).toEqual({ 'dot.x': 10 });
  });
  it('includes static values in repeated list-owned children', () => {
    const m = load(readFileSync(join(root, 'modules/lists/examples/players.ani'), 'utf8')).model!;
    const result = runScript(m, 'advance 0\nsnapshot --all');
    expect(result.snapshots[0]!.values['rows/0/dot.fill.color']).toBe('#000000');
    expect(result.snapshots[0]!.values['rows/1/dot.fill.color']).toBe('#000000');
  });
  it('plumbs optional semantic trees and diagnoses an absent module', () => {
    // The a11y module may already be registered in this process: save and restore its method.
    const original = Object.getOwnPropertyDescriptor(Player.prototype, 'semantics');
    if (!original)
      expect(() => runScript(model(), 'snapshot --semantics')).toThrow(/semantics module/);
    Object.defineProperty(Player.prototype, 'semantics', {
      configurable: true,
      value: () => [{ id: 'dot' }],
    });
    try {
      expect(runScript(model(), 'snapshot', { semantics: true }).snapshots[0]!.semantics).toEqual([
        { id: 'dot' },
      ]);
    } finally {
      if (original) Object.defineProperty(Player.prototype, 'semantics', original);
      else delete (Player.prototype as unknown as { semantics?: unknown }).semantics;
    }
  });
  it('validates seeds and accepts runtime random documents', () => {
    expect(createScriptSession(model()).seed).toBeUndefined();
    expect(createScriptSession(model(), { seed: 42 }).seed).toBe(42);
    const randomDoc = {
      ...doc,
      requires: [...doc.requires, 'bind', 'convert'],
      converters: { rng: { type: 'formula', expression: 'random()' } },
      bind: { 'dot.x': { value: '$count', convert: 'rng' } },
    };
    const randomModel = load(randomDoc).model!;
    expect(randomModel).toBeDefined();
    expect(runScript(randomModel, 'seed 3').diagnostics).toEqual([]);
  });
  it.each([
    'touch down 1 2',
    'touch down -1 2 3',
    'touch hover 0 2 3',
    'pointer drag 0 0 1 1 in 0',
    'pointer drag 0 0 1',
    'data set count 1',
    'data set $count "bad"',
    'data watch nope',
    'data break $count != 1',
    'expect dot.x = 1',
    'expect missing == 1',
    'seed -1',
    'seed 1.5',
    'snapshot --bogus',
    'data set $title "unterminated',
    'scroll 0 0 0',
    'gamepads {}',
    'key repeat Enter bogus',
    'advance',
  ])('rejects bad script: %s', (text) => {
    expect(() => runScript(model(), text)).toThrow(ScriptError);
  });
});

describe('P3b CLI tools', () => {
  it('sample prints all outputs, fails assertions with exit 1, syntax with exit 2', async () => {
    const result = await cli([
      'sample',
      file,
      '-e',
      'data dump $count; expect $count == 1; expect $count == 2; snapshot --all',
    ]);
    expect(result.code).toBe(1);
    expect(result.out).toHaveLength(2);
    expect(result.err).toHaveLength(2);
    expect((await cli(['sample', file, '-e', 'touch bad'])).code).toBe(2);
    expect((await cli(['sample', file, '--all', '--seed', '3'])).code).toBe(0);
    // The CLI registers a11y since P3b-1, so --semantics now succeeds.
    expect((await cli(['sample', file, '--semantics'])).code).toBe(0);
    expect((await cli(['sample', file, '--seed', 'NaN'])).code).toBe(2);
  });
  it('answers one JSON line per session command, survives errors, reloads data, quits', async () => {
    const result = await cli(
      ['session', file],
      [
        'data set $count 4',
        'advance 0',
        '{"cmd":"data dump $count"}',
        '{"cmd":1}',
        '{broken',
        'touch bad',
        'reload',
        'expect $count == 4',
        'quit',
        'snapshot',
      ],
    );
    expect(result.code).toBe(0);
    const replies = result.out.map((s) => JSON.parse(s));
    expect(replies).toHaveLength(9);
    expect(replies[2].output).toEqual([{ data: { $count: 4 } }]);
    expect(replies[3].ok).toBe(false);
    expect(replies[6].reloaded).toBe(true);
    expect(replies[7].ok).toBe(true);
    expect(replies[8].quit).toBe(true);
  });
  it('reload really rereads the file and preserves the old player on invalid source', async () => {
    const f = join(dir, 'reload.ani');
    writeFileSync(f, JSON.stringify(doc));
    const output: string[] = [];
    async function* input() {
      yield 'data set $count 6';
      yield 'advance 0';
      writeFileSync(f, '{');
      yield 'reload';
      yield 'expect $count == 6';
      writeFileSync(f, JSON.stringify({ ...doc, nodes: [{ ...doc.nodes[0], r: 4 }] }));
      yield 'reload';
      yield 'snapshot --all';
      yield 'quit';
    }
    expect(
      await run(['session', f], { out: (s) => output.push(s), err() {}, input: input() }),
    ).toBe(0);
    expect(JSON.parse(output[2]!).ok).toBe(false);
    expect(JSON.parse(output[3]!).ok).toBe(true);
    expect(JSON.parse(output[5]!).snapshots[0].values['dot.r']).toBe(4);
  });
  it('reports an invalid initial session document as JSON with exit 1', async () => {
    const f = join(dir, 'invalid-session.ani');
    writeFileSync(f, '{');
    const result = await cli(['session', f], []);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.out[0]!).diagnostics[0]).toMatchObject({
      code: 'session-load',
      pointer: '',
      message: expect.any(String),
      hint: expect.any(String),
    });
  });
  it('bench reports finite compile, step and draw statistics as JSON and text', async () => {
    const result = await cli(['bench', bell, '--frames', '10', '--format=json']);
    expect(result.code).toBe(0);
    const report = JSON.parse(result.out[0]!);
    expect(report.frames).toBe(10);
    expect(report.compileMs).toBeGreaterThan(0);
    expect(report.step.p95).toBeGreaterThanOrEqual(report.step.median);
    expect(report.draw.p95).toBeGreaterThanOrEqual(report.draw.median);
    expect((await cli(['bench', bell, '--frames', '1'])).out[0]).toContain('compile');
    expect(
      (await cli(['bench', bell, '-e', 'expect swing.rotate == 99', '--format=json'])).code,
    ).toBe(1);
  });
  it.each([
    ['session'],
    ['session', file, 'extra'],
    ['bench'],
    ['bench', bell, '--frames', '0'],
    ['bench', bell, '--frames', 'NaN'],
    ['bench', bell, '--frames', '1.5'],
    ['bench', bell, '--frames', '1000001'],
  ])('CLI usage error %j', async (...args) => {
    expect((await cli(args)).code).toBe(2);
  });
  it('help describes every owned CLI command and flags', async () => {
    const result = await cli(['--help']);
    for (const word of ['session', 'bench', '--frames', '--all', '--seed', '--semantics'])
      expect(result.out[0]).toContain(word);
    expect(readFileSync(bell, 'utf8')).toContain('anima');
  });
});

describe('P3b native observations', () => {
  it('matches independently captured native data writes/dumps; reload retention is intentional', () => {
    const native = JSON.parse(
      readFileSync(join(root, 'modules/tooling/oracle/rive/set.json'), 'utf8'),
    );
    const value = native.viewModel.properties.find(
      (p: { name: string }) => p.name === 'count',
    ).value;
    const result = runScript(model(), 'data set $count 3\nadvance 0\nsnapshot $count');
    expect(result.snapshots[0]!.values.$count).toBe(value);
    const reloaded = JSON.parse(
      readFileSync(join(root, 'modules/tooling/oracle/rive/reloaded.json'), 'utf8'),
    );
    expect(reloaded.viewModel.properties[0].value).toBe(0); // native reload resets; Anima explicitly preserves data
  });
  it.each([
    ['input-key-down', 'key down F13 - a', '2'],
    [
      'input-gamepad-button',
      'gamepads [{"index":0,"connected":true}]\ngamepads [{"index":0,"connected":true,"buttons":[{"value":0.75,"pressed":true}]}]',
      '2',
    ],
    ['input-wheel-scroll', 'scroll 120 100 0 -24', '1'],
    ['input-multi-touch', 'touch down 7 10 10\ntouch down 8 10 10\ntouch up 8 10 10', '3'],
  ])('keeps %s script dispatch equal to captured native data', (name, script, frame) => {
    const base = join(root, 'tests/oracle', name);
    const native = JSON.parse(readFileSync(join(base, 'rive/frames', frame + '.json'), 'utf8'));
    const result = runScript(
      load(readFileSync(join(base, 'case.ani'), 'utf8')).model!,
      script + '\nsnapshot n',
    );
    expect(result.snapshots[0]!.values.n).toBe(
      native.viewModel.properties.find((p: { name: string }) => p.name === 'n').value,
    );
  });
});
