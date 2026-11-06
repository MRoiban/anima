import '@anima-format/core/all';
import { describe, it, expect } from 'vitest';
import { load, Player, drawFrame, toSVG, runScript } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
import { compileVertices, type Vertex } from '../../core/index.ts';
const document = (vertices: Vertex[], extra = {}) => ({
  anima: '0.1',
  name: 'vertices',
  grid: 20,
  requires: ['contour'],
  nodes: [{ id: 'a', type: 'contour', vertices, stroke: { color: '#000' }, ...extra }],
});
const vertices = (kind: Vertex['kind'], fields = {}): Vertex[] => [
  { point: [0, 10], kind: 'straight' },
  { point: [10, 0], kind, ...fields },
  { point: [20, 10], kind: 'straight' },
];
describe('authoring vertices', () => {
  it.each([
    ['straight', {}, 'M0 10L10 0L20 10'],
    ['mirrored', { handle: [2, 0] }, 'M0 10C0 10 8 0 10 0C12 0 20 10 20 10'],
    ['asymmetric', { incoming: [0, 1], outgoing: [2, 0] }, 'M0 10C0 10 9 0 10 0C12 0 20 10 20 10'],
    ['detached', { incoming: [-1, 2], outgoing: [2, 1] }, 'M0 10C0 10 9 2 10 0C12 1 20 10 20 10'],
    ['rounded', { radius: Math.SQRT2 }, 'M0 10L9 1C9.55228 0.44772 10.44772 0.44772 11 1L20 10'],
  ] as const)('compiles %s handles independently', (kind, fields, expected) => {
    const vs = vertices(kind, fields);
    expect(compileVertices(vs)).toBe(expected);
    const doc = document(vs);
    const result = load(doc);
    expect(result.diagnostics).toEqual([]);
    const p = new Player(result.model!);
    expect(drawFrame(p).nodes[0]!.geometry!.d).toBe(expected);
    expect(toSVG(p)).toContain(`d="${expected}"`);
    const roundtrip = compile(decompile(doc));
    expect(roundtrip.diagnostics).toEqual([]);
    expect(roundtrip.doc).toEqual(doc);
    expect(runScript(result.model!, 'advance 0\nsnapshot').snapshots).toHaveLength(1);
  });
  it('subtracts the grid origin before the ordinary node transform', () => {
    const doc = document(vertices('straight'), { geometryOrigin: [2, 3], x: 5 });
    const result = load(doc);
    expect(result.diagnostics).toEqual([]);
    const frame = drawFrame(new Player(result.model!));
    expect(frame.nodes[0]!.geometry!.d).toBe('M-2 7L8 -3L18 7');
    expect(frame.nodes[0]!.transform[4]).toBe(5);
  });
  it('caps rounded cutbacks at half each edge and closes the contour', () => {
    expect(
      compileVertices(
        [
          { point: [0, 0], kind: 'rounded', radius: 100 },
          { point: [4, 0], kind: 'straight' },
          { point: [4, 4], kind: 'straight' },
        ],
        true,
      ),
    ).toBe('M1.41421 1.41421C0.77392 0.77392 1.09449 0 2 0L4 0L4 4L1.41421 1.41421Z');
  });
  it.each([
    [vertices('straight', { handle: [1, 0] }), '/nodes/0/vertices/1/handle'],
    [vertices('asymmetric', { incoming: [1, 0] }), '/nodes/0/vertices/1/outgoing'],
  ] as const)('reports incompatible vertex authoring fields', (vs, pointer) => {
    const result = load(document(vs as unknown as Vertex[]));
    expect(result.model).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'bad-value',
        pointer,
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
});
