import type { Module } from '../../../packages/core/src/modules.ts';
import type { Shape } from '../../../packages/core/src/registry.ts';
/* eslint-disable @typescript-eslint/no-explicit-any -- structurally validated JSON */
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { imageRect } from './fitting.ts';
import { tupleBindings } from './binding.ts';
import { after } from '../manifest.ts';
const number: Shape = { k: 'num' };
const uv: Shape = { k: 'num', min: 0, max: 1 };
export interface Mesh {
  vertices: number[][];
  triangles: number[][];
}
const compiled = new WeakMap<object, Mesh>();
const pointers = new WeakMap<object, string>();
export function gridMesh(r: Record<string, any>, g = r.mesh.grid): Mesh {
  const [cols, rows] = g,
    vertices: number[][] = [],
    triangles: number[][] = [];
  for (let y = 0; y <= rows; y++)
    for (let x = 0; x <= cols; x++) {
      vertices.push([
        r.x0 + (r.width * x) / cols,
        r.y0 + (r.height * y) / rows,
        x / cols,
        y / rows,
      ]);
      if (x < cols && y < rows) {
        const a = y * (cols + 1) + x,
          b = a + cols + 1;
        triangles.push([a, a + 1, b + 1], [a, b + 1, b]);
      }
    }
  return { vertices, triangles };
}
export const mesh: Module = {
  name: 'mesh',
  after,
  init(registry) {
    const bind = registry.get('bind');
    if (bind) Object.assign(bind, tupleBindings(bind));
    return { ...this, init: undefined };
  },
  entries: [
    {
      target: 'node',
      shapes: {
        mesh: {
          k: 'obj',
          markup: 'mesh',
          p: {
            grid: {
              k: 'tup',
              min: 2,
              of: [
                { k: 'num', int: true, min: 1, max: 128 },
                { k: 'num', int: true, min: 1, max: 128 },
              ],
            },
            vertices: { k: 'arr', min: 3, of: { k: 'tup', min: 4, of: [number, number, uv, uv] } },
            triangles: { k: 'arr', of: { k: 'tup', min: 3, of: [number, number, number] } },
          },
        },
      },
    },
  ],
  prepare(model, d) {
    if (!model.doc.requires?.includes('mesh')) return;
    const visit = (nodes: typeof model.nodes, base: string) =>
      nodes.forEach((n, i) => {
        const at = base + '/' + i,
          r = n as unknown as Record<string, any>,
          m = r.mesh;
        if (m) {
          const p = at + '/mesh';
          if (r.type !== 'image')
            d.err(
              'rig-mesh-host',
              p,
              V && 'mesh requires an image',
              V && 'put mesh on an image node',
            );
          else if (m.grid ? m.vertices || m.triangles : !m.vertices || !m.triangles)
            d.err(
              'bad-value',
              p,
              V && 'choose grid or vertices and triangles',
              V && 'use one mesh form',
            );
          else {
            const data: Mesh = m.grid ? gridMesh(r) : m;
            compiled.set(r, data);
            if (V) pointers.set(r, at);
            if (
              !data.triangles.length ||
              data.triangles.some((t) =>
                t.some((k) => !Number.isInteger(k) || k < 0 || k >= data.vertices.length),
              )
            )
              d.err(
                'rig-mesh-index',
                p + '/triangles',
                V && 'mesh needs triangles with valid vertex indices',
                V && 'use at least one triangle and zero-based indices below the vertex count',
              );
          }
        }
        if (r.children) visit(r.children, at + '/children');
      });
    visit(model.doc.nodes, '/nodes');
  },
  model(n, key) {
    const match = /^mesh\.vertex\.(0|[1-9]\d*)$/.exec(key),
      v = match && compiled.get(n.raw)?.vertices[+match[1]!];
    if (v)
      return { prop: { type: 'point', feature: 'mesh' }, rest: v.slice(0, 2) as [number, number] };
  },
  value(_a, v, p, d) {
    if (typeof v === 'string') {
      try {
        v = JSON.parse(v);
      } catch {
        /* diagnosed below */
      }
    }
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      v.every((x) => typeof x === 'number' && Number.isFinite(x))
    )
      return v as [number, number];
    d.err('value-type', p, V && 'mesh vertex needs [x, y]', V && 'use two finite numbers');
  },
  draw: {
    frame(p, i, data, entry) {
      const r = p.model.nodes[i]!.raw,
        m = compiled.get(r);
      if (!m) return;
      if (V) entry.pointer ??= pointers.get(r);
      const g = data.geometry!;
      const points = m.vertices.flatMap(
        (v, k) =>
          (p.prop(i, 'mesh.vertex.' + k) ??
            (r.mesh.grid
              ? [r.x0 + v[2]! * g.width!, r.y0 + v[3]! * g.height!]
              : v.slice(0, 2))) as number[],
      );
      p.skinPoints?.(i, points);
      const [x, y, w, h] = r.mesh.grid ? imageRect(g) : [];
      const uv = r.mesh.grid
        ? m.vertices.flatMap((v) => [(v[2]! * g.width! - x!) / w!, (v[3]! * g.height! - y!) / h!])
        : m.vertices.flatMap((v) => v.slice(2));
      data.mesh = { points, uv, triangles: m.triangles };
    },
  },
};
