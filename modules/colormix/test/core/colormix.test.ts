import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, toSVG } from '../../../../packages/core/src/index.ts';
export const scene = {
  anima: '0.1',
  name: 'switch',
  grid: 20,
  requires: ['colormix'],
  colors: { off: '#000', on: '#fff' },
  nodes: [
    {
      id: 'track',
      type: 'rect',
      x0: 1,
      y0: 5,
      w: 18,
      h: 10,
      rx: 5,
      fill: { mix: { a: 'off', b: 'on', t: 0 } },
    },
  ],
  timelines: {
    t: {
      duration: 1,
      tracks: {
        'track.fill.mix.t': [
          [0, 0],
          [1, 1],
        ],
      },
    },
  },
  machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
};
it('mixes two theme slots on one switch track (#26)', () => {
  const r = load(scene);
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  p.step(0.5);
  expect(p.value('track.fill.mix.t')).toBe(0.5);
  expect(toSVG(p)).toContain('fill="#808080"');
});

it('conforms to independent step snapshots at start/middle/end', async () => {
  const { readFileSync } = await import('node:fs');
  const { runScript } = await import('../../../../packages/core/src/index.ts');
  const read = (f: string) =>
    readFileSync(new URL('../../conformance/' + f, import.meta.url), 'utf8');
  const r = load(read('case.ani'));
  expect(r.diagnostics).toEqual([]);
  expect(runScript(r.model!, read('script.txt')).snapshots).toEqual(
    read('expected.jsonl')
      .trim()
      .split('\n')
      .map((s) => JSON.parse(s)),
  );
});
it('round trips the descriptor AniML and JSON example', async () => {
  const { readFileSync } = await import('node:fs');
  const { compile, decompile } = await import('../../../../packages/markup/src/index.ts');
  const ani = JSON.parse(
    readFileSync(new URL('../../examples/switch.ani', import.meta.url), 'utf8'),
  );
  expect(
    compile(readFileSync(new URL('../../examples/switch.animl', import.meta.url), 'utf8')).doc,
  ).toEqual(ani);
  expect(compile(decompile(ani)).doc).toEqual(ani);
});
it.each([
  [{ a: 'missing', b: 'on', t: 0 }, 'colormix-color', '/a'],
  [{ a: 'red', b: 'on', t: 0 }, 'colormix-color', '/a'],
  [{ a: 'off', b: 'currentColor', t: 0 }, 'colormix-color', '/b'],
  [{ a: 'off', b: 'on', t: -0.1 }, 'colormix-range', '/t'],
  [{ a: 'off', b: 'on', t: 1.1 }, 'colormix-range', '/t'],
  [{ a: 'off', b: 'on' }, 'missing-key', ''],
  [{ a: 3, b: 'on', t: 0 }, 'type', '/a'],
  [{ a: 'off', b: 'on', t: '0' }, 'type', '/t'],
  [{ a: 'off', b: 'on', t: 0, extra: 1 }, 'unknown-key', '/extra'],
])('diagnoses bad mix arguments %j', (mix, code, suffix) => {
  const d = structuredClone(scene);
  d.nodes[0]!.fill.mix = mix as (typeof d.nodes)[0]['fill']['mix'];
  const r = load(d);
  expect(r.model).toBeUndefined();
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      pointer: '/nodes/0/fill/mix' + suffix,
      message: expect.any(String),
    }),
  );
  if (code.startsWith('colormix'))
    expect(r.diagnostics.find((d) => d.code === code)?.hint).toBeTruthy();
});
it('rejects conflicting sources, inherited defaults and undeclared mixing', () => {
  const d = structuredClone(scene);
  Object.assign(d.nodes[0]!.fill, { color: '#f00' });
  expect(load(d).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'colormix-source',
      pointer: '/nodes/0/fill/mix',
      hint: expect.any(String),
    }),
  );
  const inherited = structuredClone(scene);
  inherited.colors.off = 'currentColor';
  expect(load(inherited).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'colormix-color', pointer: '/nodes/0/fill/mix/a' }),
  );
  expect(load({ ...scene, requires: [] }).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'undeclared-feature', pointer: '/nodes/0/fill/mix' }),
  );
});
it('keeps ordinary paints strict when the module relaxes the required source', () => {
  const d = structuredClone(scene);
  d.nodes[0]!.fill = {} as (typeof d.nodes)[0]['fill'];
  expect(load(d).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'missing-key', pointer: '/nodes/0/fill' }),
  );
});
it('uses CSS premultiplied sRGB for transparency and honours static slot overrides', async () => {
  const { mixColor } = await import('../../core/index.ts');
  const { staticSlots } = await import('../../../../packages/core/src/index.ts');
  expect(mixColor('#ff000000', '#0000ff', 0.5)).toBe('#0000ff80');
  expect(mixColor('#f0000000', '#00000000', 0.5)).toBe('#00000000');
  const p = new Player(load(scene).model!);
  p.step(0.5);
  expect(toSVG(p, { paint: staticSlots({ off: '#ff0000', on: '#0000ff' }) })).toContain(
    'fill="#800080"',
  );
});
it('binds and clamps weight and supports strokes without paint', () => {
  const d = {
    ...scene,
    requires: ['colormix', 'bind'],
    inputs: { weight: { type: 'number', default: 2 } },
    bind: { 'track.fill.mix.t': 'weight' },
    timelines: undefined,
    machine: undefined,
  };
  delete (d as Partial<typeof d>).timelines;
  delete (d as Partial<typeof d>).machine;
  const r = load(d);
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  expect(p.value('track.fill.mix.t')).toBe(1);
  const stroke = structuredClone(scene) as unknown as {
    nodes: { fill?: unknown; stroke?: unknown }[];
    timelines?: unknown;
    machine?: unknown;
  };
  stroke.nodes[0].stroke = { mix: scene.nodes[0]!.fill.mix, width: 2 };
  delete stroke.nodes[0].fill;
  delete stroke.timelines;
  delete stroke.machine;
  expect(toSVG(new Player(load(stroke).model!))).toContain('stroke="#000000"');
});

it('preserves synthetic mask fills while mixing actual fill/stroke elements', async () => {
  const { colormixSVG } = await import('../../core/svg.ts');
  const { drawFrame, staticSlots } = await import('../../../../packages/core/src/index.ts');
  const p = new Player(load(scene).model!);
  p.step(0.5);
  const frame = drawFrame(p);
  for (const key of ['outline', 'black', 'white', 'clip-outline:0', 'fill-only']) {
    const attrs = { fill: '#fff' };
    colormixSVG.attrs!(
      frame,
      { tag: 'rect', role: 'module:composite', node: 0, key, kids: [] },
      staticSlots(),
      'a',
      attrs,
      () => ({}),
    );
    expect(attrs.fill).toBe(key === 'fill-only' ? '#808080' : '#fff');
  }
});
