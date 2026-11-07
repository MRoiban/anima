import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
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
  const handles = vertices.map((v) => {
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
    return { incoming, outgoing };
  });
  const contours = vertices.map((v, i) => {
    const p = points[i]!;
    const rounded = v.kind === 'rounded' && (closed || (i > 0 && i < vertices.length - 1));
    let a = p,
      b = p,
      c1 = p,
      c2 = p;
    if (rounded) {
      const previous = (i + points.length - 1) % points.length;
      const next = (i + 1) % points.length;
      const u = add(add(points[previous]!, handles[previous]!.outgoing), [-p[0], -p[1]]);
      const v = add(add(points[next]!, handles[next]!.incoming), [-p[0], -p[1]]);
      const ul = Math.hypot(...u),
        vl = Math.hypot(...v);
      const radius = Math.min(vertices[i]!.radius ?? 0, ul / 2, vl / 2);
      if (ul && vl) {
        const angle = Math.atan2(Math.abs(u[0] * v[1] - u[1] * v[0]), u[0] * v[0] + u[1] * v[1]);
        // Natural corner rounding; mathematical construction follows Rive (MIT), see NOTICE.
        const fraction = Math.min(
          1,
          (4 / 3) *
            Math.tan(angle / 4) *
            (angle < Math.PI / 2 ? 1 + Math.cos(angle) : 2 - Math.sin(angle)),
        );
        a = add(p, [(radius * u[0]) / ul, (radius * u[1]) / ul]);
        b = add(p, [(radius * v[0]) / vl, (radius * v[1]) / vl]);
        c1 = add(a, [(p[0] - a[0]) * fraction, (p[1] - a[1]) * fraction]);
        c2 = add(b, [(p[0] - b[0]) * fraction, (p[1] - b[1]) * fraction]);
      }
    }
    return { p, a, b, c1, c2, ...handles[i]!, rounded };
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
    if (v.rounded) d += 'C' + text(v.c1) + ' ' + text(v.c2) + ' ' + text(v.b);
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
              V && `${key} does not belong to ${v.kind} vertices`,
              V && `use ${permitted.join(', ') || 'only point and kind'}`,
            );
        if (v.kind === 'asymmetric' && !v.outgoing?.some(Boolean) && v.incoming?.some(Boolean))
          d.err(
            'bad-value',
            `${pointer}/vertices/${j}/outgoing`,
            V && 'asymmetric incoming length needs an outgoing direction',
            V && 'supply a nonzero outgoing handle',
          );
      });
      compiled.set(n.raw, compileVertices(n.raw.vertices, n.raw.closed, n.raw.geometryOrigin));
    });
  },
  outline(p, i) {
    const d = compiled.get(p.model.nodes[i]!.raw);
    if (d !== undefined) return flatten(parsePath(d));
  },
  fillContains: winding.fillContains,
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
