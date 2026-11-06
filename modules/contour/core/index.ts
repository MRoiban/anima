// Authoring geometry compiled once to ordinary SVG path data. No renderer state.
import type { Module } from '../../../packages/core/src/modules.ts';
import type { Shape } from '../../../packages/core/src/registry.ts';
import { flatten, parsePath } from '../../../packages/core/src/path.ts';
import { fmt } from '../../../packages/core/src/draw.ts';
import { winding } from './winding.ts';
import { effects } from './effects.ts';
import { after } from '../manifest.ts';
const number: Shape = { k: 'num' };
const point: Shape = { k: 'tup', of: [number, number], min: 2 };
type Point = [number, number];
export interface Vertex {
  point: Point;
  kind: 'straight' | 'mirrored' | 'asymmetric' | 'detached' | 'rounded';
  handle?: Point;
  incoming?: Point;
  outgoing?: Point;
  radius?: number;
}
const vertex: Shape = {
  k: 'obj',
  p: {
    point,
    kind: { k: 'str', of: ['straight', 'mirrored', 'asymmetric', 'detached', 'rounded'] },
    handle: point,
    incoming: point,
    outgoing: point,
    radius: { k: 'num', min: 0 },
  },
  req: ['point', 'kind'],
};
const compiled = new WeakMap<object, string>();
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const text = (a: Point) => a.map(fmt).join(' ');
export function compileVertices(
  vertices: Vertex[],
  closed = false,
  origin: Point = [0, 0],
): string {
  const points = vertices.map((v) => add(v.point, [-origin[0], -origin[1]]));
  const cut = (p: Point, q: Point, radius: number): Point => {
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const t = length ? Math.min(0.5, radius / length) : 0;
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  };
  const contours = vertices.map((v, i) => {
    const p = points[i]!;
    const rounded = v.kind === 'rounded' && (closed || (i > 0 && i < vertices.length - 1));
    const a = rounded ? cut(p, points[(i + points.length - 1) % points.length]!, v.radius ?? 0) : p;
    const b = rounded ? cut(p, points[(i + 1) % points.length]!, v.radius ?? 0) : p;
    let incoming: Point = [0, 0],
      outgoing: Point = [0, 0];
    if (v.kind === 'mirrored') {
      outgoing = v.handle ?? [0, 0];
      incoming = [-outgoing[0], -outgoing[1]];
    } else if (v.kind === 'asymmetric') {
      outgoing = v.outgoing ?? [0, 0];
      const length = Math.hypot(...outgoing);
      const magnitude = Math.hypot(...(v.incoming ?? [0, 0]));
      incoming = length
        ? [(-outgoing[0] * magnitude) / length, (-outgoing[1] * magnitude) / length]
        : [0, 0];
    } else if (v.kind === 'detached') {
      incoming = v.incoming ?? [0, 0];
      outgoing = v.outgoing ?? [0, 0];
    }
    return { p, a, b, incoming, outgoing, rounded };
  });
  let d = 'M' + text(contours[0]!.a);
  const edge = (i: number, j: number) => {
    const a = contours[i]!,
      b = contours[j]!;
    const curved = [...a.outgoing, ...b.incoming].some(Boolean);
    return curved
      ? 'C' + text(add(a.b, a.outgoing)) + ' ' + text(add(b.a, b.incoming)) + ' ' + text(b.a)
      : 'L' + text(b.a);
  };
  for (let i = 0; i < contours.length; i++) {
    const v = contours[i]!;
    if (v.rounded) d += 'Q' + text(v.p) + ' ' + text(v.b);
    if (i + 1 < contours.length) d += edge(i, i + 1);
    else if (closed) d += edge(i, 0) + 'Z';
  }
  return d;
}
export const contour: Module = {
  name: 'contour',
  after,
  entries: [
    ...effects.entries,
    ...winding.entries,
    {
      target: 'contour',
      node: { painted: true },
      shapes: {
        vertices: { k: 'alt', of: [{ k: 'arr', of: vertex, min: 2 }] },
        closed: { k: 'bool' },
        geometryOrigin: { ...point, markup: 'geometry-origin' },
      },
      required: ['id', 'type', 'vertices'],
    },
  ],
  load(model, _raw, d) {
    effects.load?.(model, _raw, d);
    const paths: string[] = [],
      counts = new Map<number, number>();
    model.nodes.forEach((n, i) => {
      const index = counts.get(n.parent) ?? 0;
      counts.set(n.parent, index + 1);
      const pointer = (paths[i] =
        (n.parent < 0 ? '/nodes' : paths[n.parent] + '/children') + '/' + index);
      if (String(n.type) !== 'contour') return;
      (n.raw.vertices as Vertex[]).forEach((v, j) => {
        const permitted =
          v.kind === 'mirrored'
            ? ['handle']
            : v.kind === 'asymmetric' || v.kind === 'detached'
              ? ['incoming', 'outgoing']
              : v.kind === 'rounded'
                ? ['radius']
                : [];
        for (const key of ['handle', 'incoming', 'outgoing', 'radius'])
          if (key in v && !permitted.includes(key))
            d.err(
              'bad-value',
              `${pointer}/vertices/${j}/${key}`,
              `${key} does not belong to ${v.kind} vertices`,
              `use ${permitted.join(', ') || 'only point and kind'}`,
            );
        if (v.kind === 'asymmetric' && !v.outgoing?.some(Boolean) && v.incoming?.some(Boolean))
          d.err(
            'bad-value',
            `${pointer}/vertices/${j}/outgoing`,
            'asymmetric incoming length needs an outgoing direction',
            'supply a nonzero outgoing handle',
          );
      });
      compiled.set(n.raw, compileVertices(n.raw.vertices, n.raw.closed, n.raw.geometryOrigin));
    });
  },
  outline(p, i) {
    const d = compiled.get(p.model.nodes[i]!.raw);
    if (d !== undefined) return flatten(parsePath(d));
  },
  draw: {
    tree(model, tree) {
      model.nodes.forEach((n, i) => {
        if (String(n.type) === 'contour') tree.nodes[i]!.kind = 'path';
        if (
          n.raw.fill?.winding ||
          n.raw.paints?.some((p: { fill?: { winding?: string } }) => p.fill?.winding) ||
          n.raw.stroke?.trim ||
          n.raw.stroke?.effects ||
          n.raw.paints?.some(
            (p: { stroke?: { trim?: unknown; effects?: unknown } }) =>
              p.stroke?.trim || p.stroke?.effects,
          )
        )
          tree.resources.push({ node: i, kind: 'contour-effects' });
      });
    },
    frame(p, i, data, entry, frame) {
      const d = compiled.get(p.model.nodes[i]!.raw);
      if (d !== undefined) data.geometry = { kind: 'path', d };
      effects.draw?.frame?.(p, i, data, entry, frame);
      winding.draw?.frame?.(p, i, data, entry, frame);
    },
  },
};
