import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import '../../../../packages/core/src/all.ts';
import { load, Player, drawFrame, jsonSchema, toSVG } from '../../../../packages/core/src/index.ts';
import { posepad } from '../../core/index.ts';
import { handles } from '../../core/handle.ts';
import { Diags } from '../../../../packages/core/src/diag.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
const circle = { id: 'eye', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } };
function scene(pad: object = {}, extras: object = {}) {
  return {
    anima: '0.1',
    name: 'pad',
    grid: 20,
    requires: ['posepad', 'bind'],
    nodes: [
      circle,
      { id: 'handle', type: 'group', children: [] },
      { id: 'pad', type: 'posepad', timelineX: 'horizontal', timelineY: 'vertical', ...pad },
    ],
    timelines: {
      horizontal: {
        duration: 2,
        tracks: {
          'eye.x': [
            [0, -4],
            [2, 4],
          ],
        },
      },
      vertical: {
        duration: 4,
        tracks: {
          'eye.y': [
            [0, -8],
            [4, 8],
          ],
        },
      },
    },
    ...extras,
  };
}
function player(doc = scene()) {
  const result = load(doc);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
}
function pose(p: Player) {
  return [p.num(0, 'x', 0), p.num(0, 'y', 0)];
}
it.each([-1, -0.5, 0, 0.25, 1])(
  'poses each independent duration at %s without playing a clock',
  (v) => {
    const p = player(scene({ valueX: v, valueY: -v }));
    expect(p.step(0).settled).toBe(true);
    expect(pose(p)).toEqual([v * 4, -v * 8 || 0]);
    expect(p.values()).toMatchObject({ 'eye.x': v * 4, 'eye.y': -v * 8 || 0 });
    expect(drawFrame(p).nodes[0]!.transform.slice(4)).toEqual(pose(p));
  },
);
it.each([
  [true, false, -2, -4],
  [false, true, 2, 4],
  [true, true, -2, 4],
])('inverts each axis independently', (invertX, invertY, x, y) => {
  const p = player(scene({ valueX: 0.5, valueY: -0.5, invertX, invertY }));
  p.step(0);
  expect(pose(p)).toEqual([x, y]);
});
it('clamps authored and bound controls', () => {
  const p = player(scene({ valueX: 9, valueY: -9 }));
  p.step(0);
  expect(pose(p)).toEqual([4, -8]);
  const b = player(
    scene(
      {},
      {
        inputs: { x: { type: 'number' }, y: { type: 'number' } },
        bind: { 'pad.valueX': 'x', 'pad.valueY': 'y' },
      },
    ),
  );
  b.set('x', 3);
  b.set('y', -3);
  b.step(0);
  expect(pose(b)).toEqual([4, -8]);
});
it('overlays playing layers and bindings, with Y winning collisions', () => {
  const doc = scene(
    { valueX: 1, valueY: -1 },
    {
      inputs: { level: { type: 'number', default: 2 } },
      bind: { 'eye.x': 'level' },
      machine: {
        layers: { base: { initial: 'hold', states: { hold: { pose: { 'eye.x': 3 } } } } },
      },
    },
  );
  doc.timelines.vertical.tracks = {
    'eye.x': [
      [0, -8],
      [4, 8],
    ],
  } as never;
  const p = player(doc);
  p.step(0);
  expect(p.value('eye.x')).toBe(-8);
});
it('keeps values and hooks per player and does not install hooks without requires', () => {
  const a = player(),
    b = new Player(a.model);
  a.step(0);
  expect(Object.hasOwn(a, 'prop')).toBe(true);
  expect(Object.hasOwn(b, 'prop')).toBe(false);
  b.step(0);
  expect(pose(a)).toEqual(pose(b));
  const plain = load({ anima: '0.1', name: 'plain', grid: 20, nodes: [circle] }).model!;
  expect(plain.afterStep).toBeUndefined();
  expect(plain.rigPose).toBeUndefined();
  const p = new Player(plain);
  p.step(0);
  expect(Object.hasOwn(p, 'prop')).toBe(false);
});
it('reads a handle pivot in transformed pad coordinates', () => {
  const doc = scene({ handle: 'handle', box: [0, 0, 4, 8], x: 4, y: 2, rotate: 90, scale: 2 });
  doc.nodes[1] = { id: 'handle', type: 'group', pivot: [0, 2], x: -4, y: 6 } as never;
  const p = player(doc);
  p.step(0);
  expect(p.value('pad.valueX')).toBeCloseTo(0.5);
  expect(p.value('pad.valueY')).toBeCloseTo(0);
  expect(pose(p)[0]).toBeCloseTo(2);
  expect(pose(p)[1]).toBeCloseTo(0);
});
it('reads a pointer-dragged handle through queued input and bindings', () => {
  const result = compile(
    readFileSync(new URL('../../examples/look.animl', import.meta.url), 'utf8'),
  );
  expect(result.diagnostics).toEqual([]);
  const p = player(JSON.parse(result.text!) as never);
  p.step(0);
  const input = p.input();
  input.pointer('down', 10, 15);
  p.step(0);
  input.pointer('move', 14, 11);
  p.step(0);
  expect(p.values()).toMatchObject({
    'look.valueX': 1,
    'look.valueY': -1,
    'pupils.x': 1.5,
    'pupils.y': -1.5,
  });
});
it('exposes the rig pose seam for the two-pass solve', () => {
  const p = player(scene({ valueX: 1 }));
  expect(p.model.afterStep!(p)).toBe(true);
  expect(pose(p)[0]).toBe(4);
});
it('round trips registry attributes and declares the node in schema; draws no pad', () => {
  const doc = scene({ invertY: true, valueX: 0.5 });
  const text = decompile(doc),
    c = compile(text);
  expect(text).toContain('<posepad');
  expect(text).toContain('timeline-x="horizontal"');
  expect(text).toContain('invert-y="true"');
  expect(c.diagnostics).toEqual([]);
  expect(JSON.parse(c.text!)).toEqual(doc);
  expect(JSON.stringify(jsonSchema())).toContain('posepad');
  const p = player(doc);
  p.step(0);
  expect(drawFrame(p).nodes[2]!.geometry).toBeUndefined();
  expect(toSVG(p)).not.toContain('<posepad');
});
describe('diagnostics', () => {
  const expectError = (doc: object, code: string, pointer: string) => {
    const result = load(doc);
    expect(result.model).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer,
        severity: 'error',
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  };
  it('unknown timeline', () =>
    expectError(scene({ timelineX: 'missing' }), 'posepad-timeline', '/nodes/2/timelineX'));
  it('unknown handle', () =>
    expectError(
      scene({ handle: 'missing', box: [0, 0, 2, 2] }),
      'posepad-handle',
      '/nodes/2/handle',
    ));
  it('missing box', () => expectError(scene({ handle: 'handle' }), 'posepad-box', '/nodes/2/box'));
  it.each([0, -2])('nonpositive handle box %s', (width) =>
    expectError(scene({ handle: 'handle', box: [0, 0, width, 2] }), 'bad-value', '/nodes/2/box/2'),
  );
  it('binding an output', () =>
    expectError(
      scene({ handle: 'handle', box: [0, 0, 2, 2] }, { bind: { 'pad.valueX': '0' } }),
      'posepad-output',
      '/bind/pad.valueX',
    ));
  it('tracking an output', () => {
    const doc = scene({ handle: 'handle', box: [0, 0, 2, 2] });
    doc.timelines.horizontal.tracks = {
      'pad.valueX': [
        [0, 0],
        [2, 1],
      ],
    } as never;
    expectError(doc, 'posepad-output', '/timelines/horizontal/tracks/pad.valueX');
  });
  it('posing an output', () =>
    expectError(
      scene(
        { handle: 'handle', box: [0, 0, 2, 2] },
        {
          machine: {
            layers: { l: { initial: 's', states: { s: { pose: { 'pad.valueY': 1 } } } } },
          },
        },
      ),
      'posepad-output',
      '/machine/layers/l/states/s/pose/pad.valueY',
    ));
  it('writing the handle', () => {
    const doc = scene({ handle: 'handle', box: [0, 0, 2, 2] });
    doc.timelines.horizontal.tracks = {
      'handle.x': [
        [0, 0],
        [2, 1],
      ],
    } as never;
    expectError(doc, 'posepad-cycle', '/nodes/2/timelineX');
  });
  it('writing the pad coordinate frame', () => {
    const doc = scene({ handle: 'handle', box: [0, 0, 2, 2] });
    doc.timelines.horizontal.tracks = {
      'pad.x': [
        [0, 0],
        [2, 1],
      ],
    } as never;
    expectError(doc, 'posepad-cycle', '/nodes/2/timelineX');
  });
});

it('uses the active track sampler and clamps its overshoot to the target range', () => {
  const doc = scene();
  doc.timelines.horizontal.tracks = {
    'eye.opacity': [
      [0, 0],
      [2, 1],
    ],
  } as never;
  const p = player(doc);
  p.model.timelines.find((t) => t.name === 'horizontal')!.tracks[0]!.sample = () => 1.5;
  p.step(0);
  expect(p.prop(0, 'opacity')).toBe(1);
  expect(p.value('eye.opacity')).toBe(1);
});
it('snapshots typed boolean and colour track samples', () => {
  const doc = scene({ valueX: 0.5 });
  doc.timelines.horizontal.tracks = {
    'eye.visible': [
      [0, false],
      [2, true],
    ],
    'eye.fill.color': [
      [0, '#000000'],
      [2, '#ffffff'],
    ],
  } as never;
  const p = player(doc);
  p.step(0);
  expect(p.values()).toMatchObject({ 'eye.visible': false, 'eye.fill.color': '#bfbfbf' });
});
it('rejects missing handle entry with an exact nested pointer and import hint', () => {
  const previous = posepad.handles;
  try {
    posepad.handles = undefined;
    const doc = scene();
    doc.nodes[2] = {
      id: 'outer',
      type: 'group',
      children: [{ id: 'pad', type: 'posepad', handle: 'handle', box: [0, 0, 2, 2] }],
    } as never;
    expect(load(doc).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'posepad-handle',
        pointer: '/nodes/2/children/0/handle',
        hint: 'import @anima-format/web/posepad-handle',
      }),
    );
  } finally {
    posepad.handles = previous;
  }
});
it('rejects writes through a handle ancestor and transitive constraint target ancestors', () => {
  const doc = scene({ handle: 'handle', box: [0, 0, 2, 2] });
  doc.nodes[1] = {
    id: 'parent',
    type: 'group',
    children: [{ id: 'handle', type: 'group' }],
  } as never;
  doc.timelines.horizontal.tracks = {
    'parent.x': [
      [0, 0],
      [2, 1],
    ],
  } as never;
  expect(load(doc).diagnostics).toContainEqual(
    expect.objectContaining({ code: 'posepad-cycle', pointer: '/nodes/2/timelineX' }),
  );
  const p = player(scene({ handle: 'handle', box: [0, 0, 2, 2] }));
  // Pure validator probe before rig's schema is available; P8-1 integration remains pending.
  p.model.nodes[1]!.raw.constraints = [{ kind: 'copyPosition', from: 'eye' }];
  const d = new Diags();
  handles.validate(p.model, [2], d);
  expect(d.list).toContainEqual(
    expect.objectContaining({ code: 'posepad-cycle', pointer: '/nodes/2/timelineX' }),
  );
});
