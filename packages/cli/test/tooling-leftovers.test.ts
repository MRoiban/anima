import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, runScript } from '@anima-format/core';
import { createScriptSession } from '../../core/src/script.ts';
import { compile } from '@anima-format/markup';
import { readFileSync } from 'node:fs';
const lcg = (seed: number) => (Math.imul(1664525, seed) + 1013904223) >>> 0;
const randomModel = () => {
  const { doc } =
    compile(`<anima version="0.1" name="seed-probe" grid="20" requires="machine data bind convert" machineSeed="1000">
    <model name="State"><number name="value"/></model>
    <converter name="rng" type="formula" expression="random()"/>
    <circle id="dot" cx="10" cy="10" r="1" fill="#000"/>
    <bind target="dot.y" value="$value" convert="rng"/>
    <layer name="l" initial="a"><state name="a" kind="random"><pose/><on when="@after(0)" to="b" weight="1"/><on when="@after(0)" to="c" weight="1"/></state><state name="b"><pose dot.x="5"/></state><state name="c"><pose dot.x="10"/></state></layer>
  </anima>`);
  const result = load(doc!);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return result.model!;
};
it('preserves legacy machine/converter defaults and shares explicit seeds in draw order', () => {
  const model = randomModel();
  const legacy = new Player(model);
  legacy.step(0);
  expect(legacy.states().l).toBe(lcg(1000) / 2 ** 32 < 0.5 ? 'b' : 'c');
  expect(legacy.value('dot.y')).toBe(lcg(1) / 2 ** 32);
  const equalDefaults = new Player(load({ ...model.doc, machineSeed: 1 }).model!);
  equalDefaults.step(0);
  expect(equalDefaults.states().l).toBe('b');
  expect(equalDefaults.value('dot.y')).toBe(lcg(1) / 2 ** 32);

  for (const seed of [0, 1, 42, 0xffffffff]) {
    const p = new Player(model, { seed });
    p.step(0);
    expect(p.states().l).toBe(lcg(seed) / 2 ** 32 < 0.5 ? 'b' : 'c');
    expect(p.value('dot.y')).toBe(lcg(lcg(seed)) / 2 ** 32);
    expect(
      runScript(model, 'seed ' + seed + '\nadvance 0\nsnapshot').snapshots[0]?.values['dot.y'],
    ).toBe(p.value('dot.y'));
    expect(runScript(model, 'advance 0\nsnapshot', { seed }).snapshots[0]?.values['dot.y']).toBe(
      p.value('dot.y'),
    );
  }
});
it('reseed resets the source without changing cached once values or other players', () => {
  const model = randomModel();
  const engine = createScriptSession(model, { seed: 42 });
  engine.execute('advance 0\nseed 42\nadvance 0');
  expect(engine.player.value('dot.y')).toBe(lcg(42) / 2 ** 32);
  const other = new Player(model, { seed: 42 });
  other.step(0);
  expect(other.value('dot.y')).toBe(lcg(lcg(42)) / 2 ** 32);
  const onceDoc = structuredClone(model.doc);
  onceDoc.converters.rng.random = 'once';
  const once = createScriptSession(load(onceDoc).model!, { seed: 42 });
  once.execute('advance 0');
  const cached = once.player.value('dot.y');
  once.execute('seed 3\nadvance 0');
  expect(once.player.value('dot.y')).toBe(cached);
  expect(once.player.randomSource.next()).toBe(lcg(3) / 2 ** 32);
});
const dataModel = () =>
  load(
    readFileSync(
      new URL('../../../spec/conformance/tooling-input-data/case.ani', import.meta.url),
      'utf8',
    ),
  ).model!;
it.each([
  ['data set $count 0', undefined, 'script line 2: data set $count 0'],
  ['data set $count 7\ndata set $count 0', 7, 'script line 2: data set $count 7'],
  ['set $count 0', undefined, 'script line 2: set $count 0'],
])('traps same/transient writes before the live step: %s', (ops, condition, writer) => {
  const engine = createScriptSession(dataModel());
  const result = engine.execute(
    'data break $count' +
      (condition === undefined ? '' : ' == ' + condition) +
      '\n' +
      ops +
      '\nadvance 1\nsnapshot',
  );
  expect(result.stopped).toBe(true);
  expect(result.diagnostics[0]?.writer).toEqual([writer]);
  expect(engine.player.time).toBe(0);
  expect(engine.player.data.get('$main:count')).toBe(0);
  expect(engine.execute('data break clear\nadvance 1').diagnostics).toEqual([]);
  expect(engine.player.data.get('$main:count')).toBe(0);
});
it('reports the actual listener for an overwritten write', () => {
  const model = dataModel();
  const doc = structuredClone(model.doc);
  doc.listeners.push({ ...doc.listeners[0], set: { $count: 0 } });
  const engine = createScriptSession(load(doc).model!);
  const result = engine.execute('data break $count == 5\npointer down 10 10');
  expect(result.stopped).toBe(true);
  expect(result.diagnostics[0]?.writer).toEqual(['listener: /listeners/0']);
});

it.each([
  ['headless-fit-contain', ['--fit', 'contain']],
  ['headless-fit-cover', ['--fit', 'cover']],
  ['headless-fit-fill', ['--fit', 'fill']],
  ['headless-fit-none', ['--fit', 'none']],
  ['headless-viewport', ['--viewport', '240x240']],
  ['headless-scale', ['--component', 'other', '--viewport', '480x480', '--scale', '0.5']],
  ['headless-artboard', ['--component', 'other']],
  ['pixel-probe', ['--component', 'other']],
])('matches native central pixels through CLI flags: %s', async (name, flags) => {
  const { run } = await import('../src/cli.ts');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { comparePNG } = await import('../src/compare-png.ts');
  const dir = mkdtempSync(join(tmpdir(), 'anima-native-tooling-'));
  try {
    const source = join(dir, 'scene.animl'),
      target = join(dir, 'frame.png');
    writeFileSync(
      source,
      `<anima version="0.1" name="native-flags" grid="120" viewBox="0 0 120 60" requires="components">
      <component name="other" grid="240"><rect id="background" x0="0" y0="0" width="240" height="240" fill="#ffffff"/><rect id="blue" x0="60" y0="60" width="120" height="120" fill="#0000ff"/></component>
      <rect id="red" x0="0" y0="0" width="120" height="60" fill="#ff0000"/>
      <rect id="blue" x0="30" y0="15" width="60" height="30" fill="#0000ff"/>
    </anima>`,
    );
    const out: string[] = [];
    expect(
      await run(
        [
          'render',
          source,
          '--size',
          '240',
          '--background',
          '#1d1d1d',
          '--probe',
          '120,120;0,0',
          '-o',
          target,
          ...flags,
        ],
        { out: (s) => out.push(s), err: (s) => out.push(s) },
      ),
      out.join('\n'),
    ).toBe(0);
    const ref = readFileSync(
      new URL('../../../tests/oracle/tooling-' + name + '/rive/frames/0.png', import.meta.url),
    );
    expect(comparePNG(readFileSync(target), ref, 0)).toMatchObject({
      pass: true,
      maxChannelDifference: 0,
    });
    if (name === 'pixel-probe')
      expect(JSON.parse(out[0]!).probes).toEqual([
        { x: 120, y: 120, rgba: [0, 0, 255, 255] },
        { x: 0, y: 0, rgba: [255, 255, 255, 255] },
      ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it('finds wiring across named data bindings, lists, listeners, machines, components and focus', async () => {
  const { wiringSummary } = await import('../src/inspect-summary.ts');
  const { doc, diagnostics } =
    compile(`<anima version="0.1" name="wiring" grid="20" requires="components data bind lists input focus machine">
    <model name="Row"><number name="score"/><number name="unused"/></model>
    <model name="Board"><list name="rows" of="Row"/><number name="count"/><number name="unused"/></model>
    <model name="Unused"><number name="orphan"/></model>
    <instance name="board" model="Board" default="true"/>
    <component name="row" grid="10" data="Row"><circle id="dot" cx="5" cy="5" r="2" fill="#000"/><bind target="dot.x" value="$score"/></component>
    <component name="orphan" grid="10"><circle id="dot" cx="5" cy="5" r="2" fill="#000"/></component>
    <repeat id="rows" list="$board:rows" component="row"/>
    <circle id="button" cx="5" cy="5" r="2" fill="#000" ><focus tab-stops="true"/></circle>
    <listener target="button" on="down" set="$board:count=2"/>
    <bind target="button.x" value="$board:count"/>
    <layer name="main" initial="idle"><state name="idle"><pose/><on when="$board:count &gt; 1" to="active"/></state><state name="active"><pose/></state><state name="lost"><pose/></state></layer>
  </anima>`);
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const result = load(doc!);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const findings = wiringSummary(result.model!, result.diagnostics);
  expect(findings.filter((d) => d.code === 'unused-model').map((d) => d.pointer)).toEqual([
    '/data/models/Unused',
  ]);
  expect(findings.filter((d) => d.code === 'unused-property').map((d) => d.pointer)).toEqual([
    '/data/models/Row/properties/unused',
    '/data/models/Board/properties/unused',
    '/data/models/Unused/properties/orphan',
  ]);
  expect(findings.filter((d) => d.code === 'unused-component').map((d) => d.pointer)).toEqual([
    '/components/orphan',
  ]);
  expect(findings.filter((d) => d.code === 'unreachable-state').map((d) => d.pointer)).toEqual([
    '/machine/layers/main/states/lost',
  ]);
  expect(findings.filter((d) => d.code === 'listener-target')).toEqual([]);
});

function tone(level: number) {
  const b = Buffer.alloc(44 + 160);
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(160, 40);
  for (let i = 0; i < 80; i++) b.writeInt16LE(level, 44 + i * 2);
  return 'data:audio/wav;base64,' + b.toString('base64');
}
function audioModel(features: string[] = []) {
  const { doc, diagnostics } =
    compile(`<anima version="0.1" name="audio-time" grid="20" requires="assets events components data bind lists ${features.join(' ')}">
    <asset name="tone" type="audio" src="${tone(1000)}"/>
    <model name="State"><number name="count" default="2"/></model>
    <component name="sound" grid="20">
      <asset name="tone" type="audio" src="${tone(12000)}"/>
      <event-def name="ping" audio="tone" volume="0.5"/>
      <audio-volume asset="tone" value="0.5"/>
      <circle id="dot" cx="10" cy="10" r="1" fill="#000"/>
      <timeline name="loop" duration="0.1" loop="loop"><track target="dot.x">0 0; 0.1 10</track><event at="0.02" name="ping"/><event at="0.08" name="ping"/></timeline>
      <layer name="main" initial="playing"><state name="playing" play="loop"/></layer>
    </component>
    <instance id="one" component="sound"/>
    <repeat id="rows" count="$count" component="sound"/>
  </anima>`);
  expect(diagnostics).toEqual([]);
  const result = load(doc!);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return result.model!;
}
it.each([[], ['machine'], ['motion'], ['motion', 'machine']])(
  'captures exact within-step scoped audio occurrence times: %j',
  (...args) => {
    const features = args as string[];
    const model = audioModel(features);
    const events: import('../../core/src/event-capture.ts').CapturedEvent[] = [];
    const engine = createScriptSession(model, {
      onEvents: (batch) => events.push(...batch.filter((e) => e.audio)),
    });
    engine.execute('advance 0.25');
    expect(events).toHaveLength(15);
    for (const name of ['one.ping', 'rows.0.ping', 'rows.1.ping']) {
      const times = events.filter((e) => e.name === name).map((e) => e.time);
      expect(times).toHaveLength(5);
      times.forEach((t, i) => expect(t).toBeCloseTo([0.02, 0.08, 0.12, 0.18, 0.22][i]!, 12));
    }
  },
);
it('mixes component and repeat clips from their declaring catalog and exact timeline positions', async () => {
  const { mixAudio } = await import('../src/audio.ts');
  const model = audioModel();
  const events: import('../../core/src/event-capture.ts').CapturedEvent[] = [];
  const engine = createScriptSession(model, {
    onEvents: (batch) => events.push(...batch.filter((e) => e.audio)),
  });
  engine.execute('advance 0.25');
  const wav = await mixAudio(model, events, 0.25, '/tmp/source.animl');
  const sample = (t: number) => wav.readInt16LE(44 + Math.round(t * 48000) * 4);
  expect(sample(0.01)).toBe(0);
  expect(sample(0.024)).toBeCloseTo(9000, -1); // 3 voices × 12000 × event gain .5 × asset gain .5
  expect(sample(0.045)).toBe(0);
  expect(sample(0.124)).toBeCloseTo(9000, -1);
}, 20000);

it('reports reverse-binding writes even when they write the same data value', () => {
  const doc = structuredClone(dataModel().doc);
  doc.bind = { 'dot.x': { value: '$count', mode: 'to-source' } };
  const engine = createScriptSession(load(doc).model!);
  const result = engine.execute('data break $count\nadvance 0');
  expect(result.stopped).toBe(true);
  expect(result.diagnostics[0]?.writer?.[0]).toMatch(/^binding: .*bindings/);
  expect(engine.player.data.get('$main:count')).toBe(0);
});
it('reports state-machine action provenance without mutating the live player', () => {
  const { doc } =
    compile(`<anima version="0.1" name="machine-write" grid="20" requires="machine data">
    <model name="State"><number name="count"/></model><circle id="dot" cx="0" cy="0" r="1" fill="#000"/>
    <layer name="main" initial="idle"><state name="idle"><pose/><on when="@after(1)" to="active"/></state><state name="active" enterActions="{&quot;set&quot;:{&quot;$count&quot;:0}}"><pose/></state></layer>
  </anima>`);
  const result = load(doc!);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const engine = createScriptSession(result.model!);
  const stopped = engine.execute('data break $count\nadvance 1\nadvance 0');
  expect(stopped.stopped).toBe(true);
  expect(stopped.diagnostics[0]?.writer?.[0]).toMatch(
    /machine action: \/machine\/layers\/main\/states\/active\/enterActions/,
  );
  expect(engine.player.states().main).toBe('active');
  expect(engine.player.time).toBe(1);
});
it('shares seeded draws through component and dynamically created repeat players', () => {
  const child = structuredClone(randomModel().doc);
  for (const key of ['anima', 'name', 'requires', 'components', 'title', 'meta', '$schema'])
    Reflect.deleteProperty(child, key);
  delete child.bind;
  delete child.converters;
  delete child.data;
  const doc = {
    anima: '0.1',
    name: 'seeded-children',
    grid: 20,
    requires: ['components', 'lists', 'data', 'bind', 'convert', 'machine'],
    components: { child },
    data: { models: { Root: { properties: { count: { type: 'number', default: 1 } } } } },
    nodes: [
      { id: 'one', type: 'instance', component: 'child' },
      { id: 'rows', type: 'repeat', count: '$count', component: 'child' },
    ],
  };
  const result = load(doc);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const a = runScript(result.model!, 'advance 0\ndata set $count 2\nadvance 0\nsnapshot', {
    seed: 3,
  });
  const b = runScript(result.model!, 'seed 3\nadvance 0\ndata set $count 2\nadvance 0\nsnapshot');
  expect(a.snapshots).toEqual(b.snapshots);
  expect(a.snapshots[0]?.values['one/dot.x']).not.toBe(a.snapshots[0]?.values['rows/0/dot.x']);
});
it('counts focus and base accessibility input use in inspect summaries', async () => {
  const doc = structuredClone(dataModel().doc);
  doc.requires!.push('focus');
  doc.inputs = {
    activate: { type: 'trigger' },
    enabled: { type: 'bool', default: true },
    orphan: { type: 'bool' },
  };
  doc.a11y = { role: 'button', label: 'Ring', activate: 'activate' };
  doc.nodes[0].focus = { enabledInput: 'enabled', tabStops: true };
  const result = load(doc);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const { wiringSummary } = await import('../src/inspect-summary.ts');
  expect(
    wiringSummary(result.model!, result.diagnostics)
      .filter((d) => d.code === 'unbound-input')
      .map((d) => d.pointer),
  ).toEqual(['/inputs/orphan']);
});

it.each([[], ['machine'], ['motion'], ['machine', 'motion']])(
  'places events in carried target intervals at exact absolute times: %j',
  (...features) => {
    const { doc, diagnostics } =
      compile(`<anima version="0.1" name="carry-audio" grid="20" requires="assets events ${features.join(' ')}">
    <asset name="tone" type="audio" src="${tone(1000)}"/><event-def name="ping" audio="tone"/>
    <circle id="dot" cx="0" cy="0" r="1" fill="#000"/>
    <timeline name="source" duration="1"><track target="dot.x">0 0; 1 1</track><event at="0.02" name="ping"/></timeline>
    <timeline name="target" duration="1"><track target="dot.x">0 0; 1 1</track><event at="0.02" name="ping"/><event at="0.1" name="ping"/></timeline>
    <layer name="main" initial="source"><state name="source" play="source"><on when="@after(0.05)" to="target"/></state><state name="target" play="target"/></layer>
  </anima>`);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const model = load(doc!).model!;
    const events: number[] = [];
    createScriptSession(model, {
      onEvents: (batch) => events.push(...batch.filter((e) => e.audio).map((e) => e.time)),
    }).execute('advance 0.2');
    expect(events).toHaveLength(3);
    events.forEach((t, i) => expect(t).toBeCloseTo([0.02, 0.07, 0.15][i]!, 12));
  },
);

it('uses the selected default instance and ignores comments in data wiring', async () => {
  const result = load({
    anima: '0.1',
    name: 'default-wiring',
    grid: 20,
    requires: ['data', 'bind'],
    data: {
      models: {
        $comment: 'This is not a model',
        First: {
          properties: { $comment: '$score is not a use', score: { type: 'number', default: 2 } },
        },
        Second: { properties: { score: { type: 'number', default: 4 } } },
        Unused: { properties: { score: { type: 'number' } } },
      },
      instances: {
        $comment: 'This is not an instance',
        first: { model: 'First' },
        chosen: { model: 'Second', default: true },
      },
    },
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
    bind: { 'dot.x': '$score' },
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(result.model!);
  p.step(0);
  expect(p.value('dot.x')).toBe(4);
  const { wiringSummary } = await import('../src/inspect-summary.ts');
  const findings = wiringSummary(result.model!, result.diagnostics);
  expect(findings.filter((d) => d.code === 'unused-model').map((d) => d.pointer)).toEqual([
    '/data/models/Unused',
  ]);
  expect(findings.filter((d) => d.code === 'unused-property').map((d) => d.pointer)).toEqual([
    '/data/models/First/properties/score',
    '/data/models/Unused/properties/score',
  ]);
});
