import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { drawFrame, load, Player, jsonSchema, runScript } from '@anima-format/core';
import { mixValues } from '../../../../packages/core/src/player.ts';
import { toSVG, affine } from '../../core/static.ts';
import { frameSVG, LIGHT, pixels } from '../../../../packages/cli/src/render.ts';
import { compile, decompile } from '@anima-format/markup';
const fixture = (name = 'rigging-mesh') =>
  JSON.parse(readFileSync(`spec/conformance/${name}/case.ani`, 'utf8'));
function player(doc = fixture()) {
  const result = load(doc);
  expect(result.diagnostics).toEqual([]);
  expect(result.model).toBeDefined();
  return new Player(result.model!);
}
it('matches independently enumerated grid and explicit draw geometry', () => {
  const p = player(),
    expected = JSON.parse(
      readFileSync('spec/conformance/rigging-mesh/drawing.expected.json', 'utf8'),
    );
  expect(drawFrame(p).nodes.map((n) => n.mesh)).toEqual(expected);
});
it('animates fractional signed tuples and binds a vertex at four independent times', () => {
  const p = player(fixture('rigging-mesh-animation'));
  const expected = JSON.parse(
    readFileSync('spec/conformance/rigging-mesh-animation/drawing.expected.json', 'utf8'),
  );
  let time = 0;
  for (const frame of expected) {
    p.step(frame.at - time);
    time = frame.at;
    const mesh = drawFrame(p).nodes[0]!.mesh!;
    expect(mesh.points.slice(4, 6)).toEqual(frame.vertex);
    expect(mesh.points.slice(6, 8)).toEqual(frame.bound);
    expect(p.value('flag.mesh.vertex.2')).toEqual(frame.vertex);
  }
  p.set('x', -0.125);
  p.set('y', 3);
  p.step(0);
  expect(drawFrame(p).nodes[0]!.mesh!.points.slice(6, 8)).toEqual([-0.125, 5]);
  expect(mixValues([-2.5, 1.25], [3.5, -6.75], 0.25)).toEqual([-1, -0.75]);
});
it('samples tuple state crossfades without colour rounding', () => {
  const doc = fixture('rigging-mesh-animation');
  delete doc.bind;
  delete doc.inputs;
  doc.timelines = {
    a: { duration: 1, tracks: { 'flag.mesh.vertex.0': [[0, [-2.5, 1.25]]] } },
    b: { duration: 1, tracks: { 'flag.mesh.vertex.0': [[0, [3.5, -6.75]]] } },
  };
  doc.machine = {
    layers: {
      main: {
        initial: 'a',
        states: {
          a: { play: 'a', on: [{ to: 'b', when: '@after(0)', blend: 1 }] },
          b: { play: 'b' },
        },
      },
    },
  };
  const p = player(doc);
  p.step(0);
  p.step(0.25);
  expect(drawFrame(p).nodes[0]!.mesh!.points.slice(0, 2)).toEqual([-1, -0.75]);
});
it('uses the optional skin provider without mutating rest or another player', () => {
  const a = player(),
    b = new Player(a.model);
  a.skinPoints = (_i, xy) => {
    for (let k = 0; k < xy.length; k++) xy[k]! += 2;
  };
  expect(drawFrame(a).nodes[0]!.mesh!.points[0]).toBe(4);
  expect(drawFrame(b).nodes[0]!.mesh!.points[0]).toBe(2);
});
it('preserves uv order for explicit meshes and fits grid uv to the plain image', () => {
  const doc = fixture();
  doc.nodes[0].width = 8;
  doc.nodes[0].height = 8;
  let p = player(doc),
    m = drawFrame(p).nodes[0]!.mesh!;
  expect(m.uv).toEqual([0, -0.5, 0.5, -0.5, 1, -0.5, 0, 1.5, 0.5, 1.5, 1, 1.5]);
  doc.nodes[0].fit = 'cover';
  doc.nodes[0].align = 'right';
  p = player(doc);
  m = drawFrame(p).nodes[0]!.mesh!;
  expect(m.uv).toEqual([0.5, 0, 0.75, 0, 1, 0, 0.5, 1, 0.75, 1, 1, 1]);
});
it('has registry JSON schema and generic AniML mesh attributes with lossless round trips', () => {
  const doc = fixture();
  expect(JSON.stringify(jsonSchema())).toContain('mesh');
  const src = decompile(doc);
  expect(src).toContain('mesh=');
  const compiled = compile(src);
  expect(compiled.diagnostics).toEqual([]);
  expect(compiled.doc).toEqual(doc);
});
it('CLI triangle output deforms while retained SVG keeps the image box', () => {
  const p = player(fixture('rigging-mesh-animation'));
  p.step(0.5);
  expect(() => toSVG(p)).toThrowError(
    expect.objectContaining({
      code: 'unsupported-render',
      pointer: '/nodes/0/mesh',
      message: expect.stringContaining('mesh'),
      hint: expect.stringContaining('canvas'),
    }),
  );
  const svg = frameSVG(p, LIGHT, 240);
  expect(svg).toContain('<clipPath');
  expect(svg).toContain('mesh0-');
  expect(svg).toContain('9.5 3.25');
  expect(pixels(svg, 240).some((v) => v !== 0)).toBe(true);
  expect(affine([0, 0, 2, 0, 0, 3], [0, 0, 1, 0, 0, 1], [0, 1, 2])).toEqual([2, 0, 0, 3, 0, 0]);
  expect(affine([0, 0, 2, 0, 0, 3], [0, 0, 0, 0, 0, 0], [0, 1, 2])).toBeUndefined();
});
it.each(['rigging-mesh', 'rigging-mesh-animation'])('conformance snapshots: %s', (name) => {
  const p = player(fixture(name));
  const result = runScript(p.model, readFileSync(`spec/conformance/${name}/script.txt`, 'utf8'));
  const expected = readFileSync(`spec/conformance/${name}/expected.jsonl`, 'utf8')
    .trim()
    .split('\n')
    .map((s) => JSON.parse(s));
  expect(result.snapshots).toEqual(expected);
});
describe('strict diagnostics', () => {
  const bad = (edit: (doc: ReturnType<typeof fixture>) => void, code: string, pointer: string) => {
    const doc = fixture();
    edit(doc);
    const result = load(doc);
    expect(result.model).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer,
        message: expect.any(String),
        ...(code === 'unknown-address' ? {} : { hint: expect.any(String) }),
      }),
    );
  };
  it('rig-mesh-host', () =>
    bad(
      (d) => {
        d.nodes[0] = { id: 'bad', type: 'group', mesh: { grid: [1, 1] } };
      },
      'rig-mesh-host',
      '/nodes/0/mesh',
    ));
  it.each([[], [[0, 1, 4]], [[-1, 1, 2]], [[0.5, 1, 2]]].map((triangles) => ({ triangles })))(
    'rig-mesh-index $triangles',
    ({ triangles }) =>
      bad(
        (d) => {
          d.nodes[1].mesh.triangles = triangles;
        },
        'rig-mesh-index',
        '/nodes/1/mesh/triangles',
      ),
  );
  it('uv range', () =>
    bad(
      (d) => {
        d.nodes[1].mesh.vertices[0][2] = 1.1;
      },
      'bad-value',
      '/nodes/1/mesh/vertices/0/2',
    ));
  it('exclusive forms', () =>
    bad(
      (d) => {
        d.nodes[1].mesh.grid = [1, 1];
      },
      'bad-value',
      '/nodes/1/mesh',
    ));
  it('missing form', () =>
    bad(
      (d) => {
        d.nodes[0].mesh = {};
      },
      'bad-value',
      '/nodes/0/mesh',
    ));
  it('bad tuple track', () =>
    bad(
      (d) => {
        d.timelines = { bad: { duration: 1, tracks: { 'grid.mesh.vertex.0': [[0, [1, 2, 3]]] } } };
      },
      'value-type',
      '/timelines/bad/tracks/grid.mesh.vertex.0/0/1',
    ));
  it('unknown vertex', () =>
    bad(
      (d) => {
        d.timelines = { bad: { duration: 1, tracks: { 'grid.mesh.vertex.100': [[0, [1, 2]]] } } };
      },
      'unknown-address',
      '/timelines/bad/tracks/grid.mesh.vertex.100',
    ));
  it('nested pointer', () =>
    bad(
      (d) => {
        d.nodes = [
          {
            id: 'group',
            type: 'group',
            children: [{ id: 'bad', type: 'group', mesh: { grid: [1, 1] } }],
          },
        ];
      },
      'rig-mesh-host',
      '/nodes/0/children/0/mesh',
    ));
});
it('keeps grid topology/UVs while following an animated image box', () => {
  const doc = fixture();
  doc.timelines = {
    resize: {
      duration: 1,
      tracks: {
        'grid.width': [
          [0, 8],
          [1, 16],
        ],
      },
    },
  };
  doc.machine = { layers: { main: { initial: 'go', states: { go: { play: 'resize' } } } } };
  const p = player(doc);
  p.step(1);
  const m = drawFrame(p).nodes[0]!.mesh!;
  expect(m.points).toEqual([2, 3, 10, 3, 18, 3, 2, 7, 10, 7, 18, 7]);
  // contain uses the original 2:1 image at 8×4, centred in the 16×4 box.
  expect(m.uv).toEqual([-0.5, 0, 0.5, 0, 1.5, 0, -0.5, 1, 0.5, 1, 1.5, 1]);
});
it('point binding syntax reports its pointer, message and hint', () => {
  const doc = fixture('rigging-mesh-animation');
  doc.bind['flag.mesh.vertex.3'] = 'x';
  const result = load(doc);
  expect(result.model).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'bind-type',
      pointer: '/bind/flag.mesh.vertex.3',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
it('preserves point values in posepad overlays after the P8 merge', () => {
  const doc = fixture('rigging-mesh-animation');
  doc.requires.push('posepad');
  doc.nodes.push({ id: 'pad', type: 'posepad', timelineX: 'wave', valueX: 0 });
  const p = player(doc);
  p.step(0);
  expect(p.value('flag.mesh.vertex.2')).toEqual([9.5, 3.25]);
  expect(drawFrame(p).nodes[0]!.mesh!.points.slice(4, 6)).toEqual([9.5, 3.25]);
});
