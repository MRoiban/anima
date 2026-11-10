import '@anima-format/core/all';
import { describe, it, expect } from 'vitest';
import { compile, decompile } from '@anima-format/markup';
import {
  Player,
  load,
  runScript,
  registerModule,
  drawFrame,
  apply,
  IDENTITY,
} from '@anima-format/core';
import { rig, blend, compose, decompose, type ConstraintKind } from '../../core/index.ts';
const doc = (nodes: object[], extra: object = {}) => ({
  anima: '0.1',
  name: 'rig-test',
  grid: 20,
  requires: ['rig'],
  nodes,
  ...extra,
});
const group = (id: string, extra: object = {}) => ({ id, type: 'group', ...extra });
const player = (raw: object) => {
  const r = load(raw);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
};
const pos = (p: Player, id: string) => {
  const v = p.values();
  return [v[id + '.world.x'], v[id + '.world.y']];
};
describe('rig', () => {
  it('keeps rigid art at rest and follows an animated chain without re-origining', () => {
    const p = player(
      doc(
        [
          {
            id: 'a',
            type: 'bone',
            x: 2,
            y: 5,
            length: 4,
            children: [
              {
                id: 'b',
                type: 'bone',
                length: 3,
                children: [
                  { id: 'art', type: 'circle', center: [9, 5], r: 1, fill: { color: '#000' } },
                ],
              },
            ],
          },
        ],
        {
          timelines: {
            go: {
              duration: 1,
              tracks: {
                'a.rotate': [
                  [0, 0],
                  [1, 90],
                ],
                'a.length': [
                  [0, 4],
                  [1, 6],
                ],
              },
            },
          },
          machine: { layers: { m: { initial: 'go', states: { go: { play: 'go' } } } } },
        },
      ),
    );
    expect(p.local(0)).toEqual(IDENTITY);
    expect(p.local(1)).toEqual(IDENTITY);
    p.step(1);
    expect(pos(p, 'b')[0]).toBeCloseTo(2);
    expect(pos(p, 'b')[1]).toBeCloseTo(11);
    expect(apply(p.world(2), 9, 5)[1]).toBeCloseTo(14);
  });
  it('resolves a forward target and ordered partial strengths without drift', () => {
    const p = player(
      doc([
        group('a', {
          pivot: [2, 3],
          constraints: [
            { kind: 'copyPosition', from: 'b', strength: 0.5 },
            { kind: 'copyPosition', from: 'c', strength: 0.5 },
          ],
        }),
        group('b', { x: 10, y: 4 }),
        group('c', { x: 4, y: 10 }),
      ]),
    );
    expect(pos(p, 'a')).toEqual([5, 6.75]);
    for (let i = 0; i < 10; i++) p.step(0);
    expect(pos(p, 'a')).toEqual([5, 6.75]);
  });
  it('uses document-rest offsets even when destination parents animate', () => {
    const p = player(
      doc(
        [
          group('parent', {
            x: 5,
            children: [
              group('a', {
                x: 2,
                constraints: [
                  {
                    kind: 'copyPosition',
                    from: 'b',
                    fromSpace: 'local',
                    toSpace: 'local',
                    offset: true,
                  },
                ],
              }),
            ],
          }),
          group('b', { x: 4 }),
        ],
        {
          timelines: {
            go: {
              duration: 1,
              tracks: {
                'parent.x': [
                  [0, 5],
                  [1, 10],
                ],
              },
            },
          },
          machine: { layers: { m: { initial: 'go', states: { go: { play: 'go' } } } } },
        },
      ),
    );
    expect(pos(p, 'a')[0]).toBe(11);
    p.step(1);
    expect(pos(p, 'a')[0]).toBe(16);
  });
  it('interpolates a whole origin tuple without rounding its coordinates', () => {
    const p = player(
      doc(
        [
          { id: 'target', type: 'rect', x0: 2, y0: 3, w: 4, h: 2, fill: { color: '#888' } },
          group('a', { constraints: [{ kind: 'copyTransform', from: 'target', origin: [0, 0] }] }),
        ],
        {
          timelines: {
            go: {
              duration: 1,
              tracks: {
                'a.constraints.0.origin': [
                  [0, [0, 0]],
                  [1, [1, 1]],
                ],
              },
            },
          },
          machine: { layers: { m: { initial: 'go', states: { go: { play: 'go' } } } } },
        },
      ),
    );
    p.step(0.123456789);
    expect(pos(p, 'a')[0]).toBeCloseTo(2 + 4 * 0.123456789, 12);
    expect(pos(p, 'a')[1]).toBeCloseTo(3 + 2 * 0.123456789, 12);
  });
  it('bounds rotated descendant rects and ellipses exactly for origin (S2-4)', () => {
    const at = (child: object) =>
      pos(
        player(
          doc(
            [
              group('target', {
                children: [{ id: 'c', rotate: 45, fill: { color: '#888' }, ...child }],
              }),
              group('a', {
                constraints: [{ kind: 'copyTransform', from: 'target', origin: [0, 0] }],
              }),
            ],
            { requires: ['rig', 'paint'] },
          ),
        ),
        'a',
      );
    const [rx, ry] = at({ type: 'rect', x0: 0, y0: 0, w: 10, h: 10 });
    expect(rx).toBeCloseTo(-10 / Math.SQRT2, 9);
    expect(ry).toBeCloseTo(0, 9);
    // An ellipse rotated 45°: half-extents are both sqrt((rx² + ry²) / 2).
    const [ex, ey] = at({ type: 'ellipse', cx: 0, cy: 0, rx: 4, ry: 2 });
    expect(ex).toBeCloseTo(-Math.sqrt(10), 9);
    expect(ey).toBeCloseTo(-Math.sqrt(10), 9);
  });
  it('bounds arcs at any whole-turn offset of their angles (S3-1)', () => {
    for (const [from, to] of [
      [0, 180],
      [1080, 1260],
      [3600, 3780],
      [-360, -180],
    ]) {
      const p = player(
        doc([
          group('target', {
            children: [
              {
                id: 'c',
                type: 'arc',
                center: [0, 0],
                r: 10,
                from,
                to,
                stroke: { color: '#000', width: 1 },
              },
            ],
          }),
          group('a', { constraints: [{ kind: 'copyTransform', from: 'target', origin: [0, 1] }] }),
        ]),
      );
      expect(pos(p, 'a')[1]).toBeCloseTo(10, 9);
    }
  });
  it('binds both origin coordinates through the shared point value type', () => {
    const p = player(
      doc(
        [
          { id: 'target', type: 'rect', x0: 2, y0: 3, w: 4, h: 2 },
          group('a', { constraints: [{ kind: 'copyTransform', from: 'target' }] }),
        ],
        {
          requires: ['rig', 'bind'],
          inputs: {
            u: { type: 'number', default: 0.25 },
            v: { type: 'number', default: 0.75 },
          },
          bind: { 'a.constraints.0.origin': '[u, v]' },
        },
      ),
    );
    p.step(0);
    expect(pos(p, 'a')).toEqual([3, 4.5]);
  });
  it('compiles and animates an AniML origin tuple track', () => {
    const source =
      '<anima version="0.1" name="rig-origin-track" grid="20" requires="rig"><rect id="target" x0="2" y0="3" width="4" height="2" fill="#888"/><group id="a"><copy-transform from="target" origin="0 0"/></group><timeline name="go" duration="1"><track target="a.constraints.0.origin">0 [0,0]; 1 [1,1]</track></timeline><layer name="main" initial="go"><state name="go" play="go"/></layer></anima>';
    const compiled = compile(source);
    expect(compiled.diagnostics).toEqual([]);
    const p = player(compiled.doc!);
    p.step(0.25);
    expect(pos(p, 'a')[0]).toBeCloseTo(3, 12);
    expect(pos(p, 'a')[1]).toBeCloseTo(3.5, 12);
  });

  it('normalizes transform origin over a transformed group subtree', () => {
    const p = player(
      doc([
        group('target', {
          children: [
            { id: 'left', type: 'rect', x0: 1, y0: 2, w: 4, h: 2, fill: { color: '#888' } },
            { id: 'right', type: 'rect', x: 10, x0: 1, y0: 1, w: 4, h: 2, fill: { color: '#888' } },
          ],
        }),
        group('a', { constraints: [{ kind: 'copyTransform', from: 'target', origin: [1, 1] }] }),
      ]),
    );
    p.step(0);
    expect(pos(p, 'a')).toEqual([15, 4]);
  });

  it('keeps unbounded defaults before a limit track starts playing', () => {
    const p = player(
      doc(
        [group('a', { constraints: [{ kind: 'copyPosition', from: 'b' }] }), group('b', { x: 5 })],
        {
          timelines: {
            later: {
              duration: 1,
              tracks: {
                'a.constraints.0.maxX': [
                  [0, 1],
                  [1, 2],
                ],
              },
            },
          },
          machine: { layers: { m: { initial: 'idle', states: { idle: { pose: {} } } } } },
        },
      ),
    );
    p.step(0);
    expect(pos(p, 'a')[0]).toBe(5);
  });
  it('resolves the actual posepad overlay with a second solve in the same step', () => {
    const p = player(
      doc(
        [
          {
            id: 'arm',
            type: 'bone',
            x: 2,
            y: 5,
            length: 4,
            constraints: [{ kind: 'copyPosition', from: 'aim' }],
          },
          group('aim', { x: 6, y: 5 }),
          { id: 'pad', type: 'posepad', timelineX: 'look', valueX: -1 },
        ],
        {
          requires: ['rig', 'posepad', 'bind'],
          inputs: { look: { type: 'number', default: -1 } },
          bind: { 'pad.valueX': 'look' },
          timelines: {
            look: {
              duration: 1,
              tracks: {
                'aim.x': [
                  [0, 6],
                  [1, 12],
                ],
              },
            },
          },
        },
      ),
    );
    const q = new Player(p.model);
    p.set('look', 1);
    p.step(0);
    expect(pos(p, 'arm')).toEqual([12, 5]);
    expect(p.values()['arm.tip.x']).toBe(16);
    q.step(0);
    expect(pos(q, 'arm')).toEqual([6, 5]);
  });
  it('publishes constrained locals to semantic bounds and pointer hits', () => {
    const p = player(
      doc(
        [
          group('arm', {
            constraints: [{ kind: 'copyPosition', from: 'aim' }],
            children: [
              {
                id: 'art',
                type: 'rect',
                x0: 0,
                y0: 0,
                w: 2,
                h: 2,
                fill: { color: '#000' },
                a11y: { role: 'text', label: 'rigged' },
              },
            ],
          }),
          group('aim', { x: 8, y: 6 }),
        ],
        { requires: ['rig', 'a11y'], listeners: [{ on: 'click', target: 'art', emit: 'hit' }] },
      ),
    );
    p.step(0);
    expect(p.semantics().find((n) => n.id === 'art')!.bounds).toEqual([8, 6, 2, 2]);
    expect(p.hits(p.model.listeners[0]!, 9, 7)).toBe(true);
    expect(p.hits(p.model.listeners[0]!, 1, 1)).toBe(false);
  });
  it('blends shortest arcs, mirrored scales and shear about a pivot', () => {
    const a = compose([4, 5, (170 * Math.PI) / 180, 2, -3, 1], [2, 3]),
      b = compose([10, 9, (-170 * Math.PI) / 180, 4, -1, 3], [2, 3]);
    const v = decompose(blend(a, b, 0.5, [2, 3]), [2, 3]);
    expect(v[0]).toBeCloseTo(7);
    expect(v[1]).toBeCloseTo(7);
    expect(Math.abs(v[2]!)).toBeCloseTo(Math.PI);
    v.slice(3).forEach((x, i) => expect(x).toBeCloseTo([3, -2, 2][i]!));
  });
  it('publishes the first pass before posing, runs at most twice and skips unchanged solves', () => {
    const r = load(
      doc([
        group('a', { constraints: [{ kind: 'copyPosition', from: 'b' }] }),
        group('b', { x: 6 }),
      ]),
    );
    expect(r.diagnostics).toEqual([]);
    let calls = 0,
      poses = 0;
    const c = rig.context;
    r.model!.rigPose = (p) => {
      poses++;
      expect(apply(p.world(0), 0, 0)[0]).toBe(6);
      return true;
    };
    const original = rig.context;
    rig.context = c;
    const p = new Player(r.model!);
    const ctx = original(p)!;
    const get = ctx.setWorld;
    ctx.setWorld = (...args) => {
      calls++;
      get(...args);
    };
    p.step(0);
    expect(poses).toBe(2);
    expect(calls).toBe(3); // unchanged first pass; one pose pass
  });
  it('composes registration, targets and multi-node writes from a separately registered constraint', () => {
    const custom: ConstraintKind = {
      kind: 'moveChildren',
      shape: { k: 'obj', p: { target: { k: 'str' } }, req: ['target'] },
      targets: (r) => [r.target],
      writes: (_r, i, m) => m.nodes[i]!.children,
      solve(ctx, i, r) {
        for (const j of ctx.model.nodes[i]!.children)
          ctx.setWorld(j, ctx.world(ctx.model.ids.get(r.target)!));
      },
    };
    registerModule({
      name: 'rigtest',
      after: ['rig'],
      entries: [],
      init(registry) {
        (registry.get('rig') as typeof rig).registerConstraint(custom);
        return this;
      },
    });
    const p = player(
      doc([
        group('a', {
          children: [group('child')],
          constraints: [{ kind: 'moveChildren', target: 'b' }],
        }),
        group('b', { x: 8 }),
      ]),
    );
    expect(pos(p, 'child')[0]).toBe(8);
  });
  it('supports both spellings, children, schema descriptors and a canonical AniML round trip', () => {
    const s =
      '<anima version="0.1" name="rig-test" grid="20" requires="rig"><bone id="a" x="2" y="4" length="5"><circle id="art" cx="7" cy="4" r="1" fill="#000"/></bone><group id="b"><copy-position from="a" factor-x="-1"/><keep-distance to="a" distance="2"/></group></anima>';
    const r = compile(s);
    expect(r.diagnostics).toEqual([]);
    expect((r.doc!.nodes as { constraints?: object[] }[])[1]!.constraints).toEqual([
      { kind: 'copyPosition', from: 'a', factorX: -1 },
      { kind: 'keepDistance', to: 'a', distance: 2 },
    ]);
    expect(compile(decompile(r.doc!)).diagnostics).toEqual([]);
  });
  it('keeps derived values read-only and excludes them from guard operands', () => {
    const p = player(doc([group('a', { x: 3 })]));
    expect(
      runScript(p.model, 'snapshot a.world.x\nexpect a.world.x == 3').snapshots[0]!.values,
    ).toEqual({ 'a.world.x': 3 });
    expect(
      load(
        doc([group('a')], {
          timelines: { bad: { duration: 1, tracks: { 'a.world.x': [[0, 1]] } } },
        }),
      ).model,
    ).toBeUndefined();
  });
  it('invalidates transformed descendant draw records and isolates players sharing a model', () => {
    const raw = doc(
      [
        group('a', {
          constraints: [{ kind: 'copyPosition', from: 'b' }],
          children: [{ id: 'art', type: 'circle', center: [0, 0], r: 1, fill: { color: '#000' } }],
        }),
        group('b'),
      ],
      {
        timelines: {
          go: {
            duration: 1,
            tracks: {
              'b.x': [
                [0, 0],
                [1, 4],
              ],
            },
          },
        },
        machine: { layers: { m: { initial: 'go', states: { go: { play: 'go' } } } } },
      },
    );
    const p = player(raw),
      q = new Player(p.model);
    drawFrame(p);
    p.step(1);
    expect(drawFrame(p).changed).toContain(1);
    expect(pos(q, 'a')[0]).toBe(0);
    expect(pos(p, 'a')[0]).toBe(4);
  });
});
