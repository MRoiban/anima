import { apply, invert, mul, type Mat } from '../../../packages/core/src/geom.ts';
import { flatten } from '../../../packages/core/src/path.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import type { RigContext } from './api.ts';
import { origin } from './constraints.ts';

// Angles (degrees) where an ellipse with radii rx, ry reaches its x and y extremes once mapped by m:
// 0/90/180/270 when unrotated, the rotated extremes otherwise.
const extremes = (m: Mat, rx: number, ry: number): number[] =>
  [0, 1].flatMap((i) => {
    const t = (Math.atan2(m[i + 2]! * ry, m[i]! * rx) * 180) / Math.PI;
    return [t, t + 180];
  });

// Local points whose mapped extremes are the node's exact geometric bounds under the affine m.
function geometryPoints(ctx: RigContext, node: number, m: Mat): number[] {
  const n = ctx.model.nodes[node]!,
    r = n.raw,
    type = String(n.type);
  if (n.geom) return flatten(n.geom).flatMap((s) => s.pts);
  const ellipse = (x: number, y: number, rx: number, ry: number, angles: number[]) =>
    angles.flatMap((v) => {
      const q = (v * Math.PI) / 180;
      return [x + rx * Math.cos(q), y + ry * Math.sin(q)];
    });
  if (type === 'circle') return ellipse(r.center[0], r.center[1], r.r, r.r, extremes(m, r.r, r.r));
  if (type === 'arc') {
    const [x, y] = r.center,
      d = r.r,
      from = r.from,
      to = r.to,
      a = extremes(m, d, d).flatMap((t) => [-720, -360, 0, 360, 720].map((k) => t + k));
    return ellipse(x, y, d, d, [from, to, ...a.filter((v) => v > from && v < to)]);
  }
  const box = (x: number, y: number, w: number, h: number) => [
    x,
    y,
    x + w,
    y,
    x + w,
    y + h,
    x,
    y + h,
  ];
  if (type === 'rect') return box(r.x0, r.y0, r.w, r.h);
  if (type === 'ellipse') return ellipse(r.cx, r.cy, r.rx, r.ry, extremes(m, r.rx, r.ry));
  if (type === 'triangle')
    return [r.x0 + r.width / 2, r.y0, r.x0 + r.width, r.y0 + r.height, r.x0, r.y0 + r.height];
  if (type === 'polygon' || type === 'star') {
    const star = type === 'star',
      count = r[star ? 'points' : 'sides'] * (star ? 2 : 1);
    return Array.from({ length: count }, (_, j) => {
      const a = ((star ? -90 : r.rotation - 90) * Math.PI) / 180 + (j * Math.PI * 2) / count,
        d = star && j % 2 ? r.innerRadius : r.radius;
      return [r.cx + d * Math.cos(a), r.cy + d * Math.sin(a)];
    }).flat();
  }
  if (type === 'contour')
    return (r.vertices as { point: number[] }[]).flatMap((v) => v.point.slice(0, 2));
  if (['image', 'text', 'layout'].includes(type)) {
    const x = Number(r.x0 ?? 0),
      y = Number(r.y0 ?? 0),
      w = Number(r.width ?? 0),
      h = Number(r.height ?? 0);
    return box(x, y, w, h);
  }
  return [];
}

function subtreePoints(ctx: RigContext, root: number): number[] {
  const inv = invert(ctx.rest(root));
  if (!inv) return [];
  const out: number[] = [];
  const visit = (node: number) => {
    const rel = mul(inv, ctx.rest(node)),
      p = geometryPoints(ctx, node, rel);
    for (let k = 0; k < p.length; k += 2) out.push(...apply(rel, p[k]!, p[k + 1]!));
    for (const child of ctx.model.nodes[node]!.children) visit(child);
  };
  visit(root);
  return out;
}

function point(ctx: RigContext, node: number, uv: number[], frame: Mat): [number, number] {
  const points = subtreePoints(ctx, node);
  if (!points.length) return apply(frame, 0, 0);
  const at = (axis: number) => {
    const values = points.filter((_, k) => k % 2 === axis),
      lo = Math.min(...values);
    return lo + (Math.max(...values) - lo) * Number(uv[axis]);
  };
  return apply(frame, at(0), at(1));
}

function tupleBindings(bind: Module): Module {
  const expression = bind.expression!;
  return {
    ...bind,
    expression(source, types, expected, pointer, diag, read) {
      if (expected !== 'point') return expression(source, types, expected, pointer, diag, read);
      source = source.trim();
      let depth = 0,
        comma = -1;
      for (let k = 1; k < source.length - 1; k++) {
        if (source[k] === '(') depth++;
        if (source[k] === ')') depth--;
        if (source[k] === ',' && depth === 0) {
          comma = k;
          break;
        }
      }
      if (source[0] !== '[' || !source.endsWith(']') || comma < 0) {
        diag.err(
          'bind-type',
          pointer,
          V && 'origin binding needs [u-expression, v-expression]',
          V && 'use two numeric expressions inside brackets',
        );
        return;
      }
      const u = expression(source.slice(1, comma), types, 'number', pointer, diag, read),
        v = expression(source.slice(comma + 1, -1), types, 'number', pointer, diag, read);
      if (u && v) return (scope) => [u(scope) as number, v(scope) as number];
    },
  };
}

export function installOrigin(target = origin, bind?: Module): void {
  target.point = point;
  if (bind) Object.assign(bind, tupleBindings(bind));
}
