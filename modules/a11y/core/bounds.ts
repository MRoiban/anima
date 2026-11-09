import type { DrawNode, Geometry, DrawPaint } from '../../../packages/core/src/draw.ts';
import { apply, mul, trimPolys, type Mat } from '../../../packages/core/src/geom.ts';
import { parsePath, M, C, Z } from '../../../packages/core/src/path.ts';
import type { runtime, Entry } from './runtime.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { drawFrame } from '../../../packages/core/src/draw.ts';
import { polylines } from '../../contour/core/effects.ts';
// Keep primitive traversal identical to SVG: +x clockwise circles, elliptical rect corners.
function geometryPath(g: Geometry): string {
  if (g.d !== undefined) return g.d;
  if (g.r !== undefined)
    return `M${g.cx! + g.r} ${g.cy}A${g.r} ${g.r} 0 1 1 ${g.cx! - g.r} ${g.cy}A${g.r} ${g.r} 0 1 1 ${g.cx! + g.r} ${g.cy}Z`;
  const x = g.x ?? 0,
    y = g.y ?? 0,
    w = g.width ?? 0,
    h = g.height ?? 0;
  const rx = Math.min(g.rx ?? 0, w / 2),
    ry = Math.min(g.rx ?? 0, h / 2);
  const arc = `a${rx} ${ry} 0 0 1 `;
  return rx && ry
    ? `M${x + rx} ${y}h${w - 2 * rx}${arc}${rx} ${ry}v${h - 2 * ry}${arc}${-rx} ${ry}h${2 * rx - w}${arc}${-rx} ${-ry}v${2 * ry - h}${arc}${rx} ${-ry}Z`
    : `M${x} ${y}h${w}v${h}h${-w}Z`;
}
type Box = [number, number, number, number];
export let boundsScales: WeakMap<Player, [number, number]>;
type Pt = [number, number];
type Segment = Pt[];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const cross = (a: Pt, b: Pt) => a[0] * b[1] - a[1] * b[0];
const unit = (v: Pt): Pt => {
  const n = Math.hypot(...v);
  return n ? [v[0] / n, v[1] / n] : [0, 0];
};
const normal = (v: Pt): Pt => [-v[1], v[0]];
const add = (p: Pt, v: Pt, r = 1): Pt => [p[0] + v[0] * r, p[1] + v[1] * r];
const tangent = (s: Segment, end: boolean): Pt => {
  const p = end ? s.at(-1)! : s[0]!;
  for (const q of end ? [...s].reverse().slice(1) : s.slice(1)) {
    const v = end ? sub(p, q) : sub(q, p);
    if (Math.hypot(...v)) return unit(v);
  }
  return [0, 0];
};
const roots = (v: number[]) => {
  if (v.length === 2) return [];
  const [p, q, r, s] = v as [number, number, number, number];
  const a = -p + 3 * q - 3 * r + s,
    b = 2 * (p - 2 * q + r),
    c = q - p;
  if (Math.abs(a) < 1e-14) return b ? [-c / b] : [];
  const d = b * b - 4 * a * c;
  return d < 0 ? [] : [(-b + Math.sqrt(d)) / (2 * a), (-b - Math.sqrt(d)) / (2 * a)];
};
const at = (s: Segment, t: number): Pt =>
  s.length === 2
    ? add(s[0]!, sub(s[1]!, s[0]!), t)
    : ([0, 1].map(
        (k) =>
          (1 - t) ** 3 * s[0]![k]! +
          3 * (1 - t) ** 2 * t * s[1]![k]! +
          3 * (1 - t) * t * t * s[2]![k]! +
          t ** 3 * s[3]![k]!,
      ) as Pt);
/** Geometric paint support, including trims, viewport strokes and three-sigma feather. */
export function paintedBounds(
  node: DrawNode,
  matrix: Mat,
  scale: [number, number] = [1, 1],
): [number, number, number, number] | undefined {
  const points: Pt[] = [];
  const point = (p: Pt) => points.push(apply(matrix, ...p));
  const arc = (p: Pt, r: number, from: Pt, to: Pt, sweep: number) => {
    point(add(p, from, r));
    point(add(p, to, r));
    const start = Math.atan2(from[1], from[0]);
    const mod = (n: number) => (n + Math.PI * 4) % (Math.PI * 2);
    const angle = mod(sweep * (Math.atan2(to[1], to[0]) - start));
    for (const v of [
      [matrix[0], matrix[2]],
      [matrix[1], matrix[3]],
    ] as Pt[]) {
      const u = unit(v);
      for (const sign of [1, -1]) {
        const a = add([0, 0], u, sign);
        if (mod(sweep * (Math.atan2(a[1], a[0]) - start)) <= angle + 1e-12) point(add(p, a, r));
      }
    }
  };
  const path = (g: Geometry, paint?: DrawPaint) => {
    if (g.d === '') return;
    const r = paint?.kind === 'stroke' ? (paint.width ?? 1) / 2 : 0;
    const fixed = paint?.scale === 'fixed';
    const original = matrix;
    const viewport = mul([scale[0], 0, 0, scale[1], 0, 0], matrix);
    if (g.r !== undefined) {
      const center = apply(matrix, g.cx!, g.cy!);
      const radius = g.r + (fixed ? 0 : r);
      const x = radius * Math.hypot(matrix[0], matrix[2]) + (fixed ? r / scale[0] : 0),
        y = radius * Math.hypot(matrix[1], matrix[3]) + (fixed ? r / scale[1] : 0);
      points.push([center[0] - x, center[1] - y], [center[0] + x, center[1] + y]);
      return;
    }
    if (!fixed && !g.d && g.width !== undefined && g.rx) {
      const rx = Math.min(g.rx, g.width / 2),
        ry = Math.min(g.rx, (g.height ?? 0) / 2),
        x = g.x ?? 0,
        y = g.y ?? 0;
      if (rx && ry) {
        const corners: [number, number, number][] = [
          [x + g.width - rx, y + g.height! - ry, 0],
          [x + rx, y + g.height! - ry, 1],
          [x + rx, y + ry, 2],
          [x + g.width - rx, y + ry, 3],
        ];
        for (const [cx, cy, q] of corners) {
          const angles = [(q * Math.PI) / 2, ((q + 1) * Math.PI) / 2];
          for (const v of [
            [matrix[0], matrix[2]],
            [matrix[1], matrix[3]],
          ] as Pt[]) {
            const a = (Math.atan2(v[1] * ry, v[0] * rx) + 2 * Math.PI) % (2 * Math.PI);
            for (const t of [a, (a + Math.PI) % (2 * Math.PI)])
              if (t >= (q * Math.PI) / 2 && t <= ((q + 1) * Math.PI) / 2) angles.push(t);
          }
          for (const t of angles) {
            const p: Pt = [cx + rx * Math.cos(t), cy + ry * Math.sin(t)];
            point(p);
            if (r) {
              const n = unit([Math.cos(t) / rx, Math.sin(t) / ry]);
              point(add(p, n, r));
              point(add(p, n, -r));
            }
          }
        }
        return;
      }
    }
    const d = geometryPath(g);
    for (const { segs } of parsePath(d)) {
      let ss: Segment[] = [];
      let p: Pt = [0, 0],
        start: Pt = p,
        closed = false;
      for (let i = 0; i < segs.length;) {
        const op = segs[i++];
        if (op === M) {
          p = [segs[i++]!, segs[i++]!];
          start = p;
        } else if (op === Z) {
          if (p[0] !== start[0] || p[1] !== start[1]) ss.push([p, start]);
          closed = true;
          p = start;
        } else {
          const s = [p];
          for (let n = op === C ? 3 : 1; n--;) s.push([segs[i++]!, segs[i++]!]);
          ss.push(s);
          p = s.at(-1)!;
        }
      }
      if (fixed) {
        ss = ss.map((s) => s.map((p) => apply(viewport, ...p)));
        matrix = [1 / scale[0], 0, 0, 1 / scale[1], 0, 0];
      }
      for (const s of ss) {
        const world = s.map((p) => apply(matrix, ...p));
        if (!r) {
          point(s[0]!);
          point(s.at(-1)!);
        }
        for (let axis = 0; axis < 2; axis++)
          for (const t of roots(world.map((p) => p[axis]!)))
            if (t > 0 && t < 1) {
              const p = at(s, t);
              point(p);
              if (r) {
                const v = unit(axis ? [matrix[1], matrix[3]] : [matrix[0], matrix[2]]);
                point(add(p, v, r));
                point(add(p, v, -r));
              }
            }
        if (r)
          for (const end of [false, true]) {
            const p = end ? s.at(-1)! : s[0]!,
              n = normal(tangent(s, end));
            point(add(p, n, r));
            point(add(p, n, -r));
          }
      }
      if (!r || !ss.length) continue;
      for (let i = 0; i < ss.length; i++) {
        if (!closed && i === ss.length - 1) break;
        const a = ss[i]!,
          b = ss[(i + 1) % ss.length]!,
          p = a.at(-1)!,
          u = tangent(a, true),
          v = tangent(b, false),
          turn = cross(u, v);
        if (Math.abs(turn) < 1e-12) {
          if (u[0] * v[0] + u[1] * v[1] < 0 && paint?.join === 'round')
            for (const w of [
              [matrix[0], matrix[2]],
              [matrix[1], matrix[3]],
            ] as Pt[]) {
              point(add(p, unit(w), r));
              point(add(p, unit(w), -r));
            }
          continue;
        }
        const sign = turn > 0 ? -1 : 1,
          n = add([0, 0], normal(u), sign),
          m = add([0, 0], normal(v), sign);
        if (paint?.join === 'round') arc(p, r, n, m, Math.sign(turn));
        else if ((paint?.join ?? 'miter') === 'miter') {
          const h = add([0, 0], add(n, m), 1 / (1 + n[0] * m[0] + n[1] * m[1]));
          // SVG and Canvas default miter limit: 4, ratio of miter length to stroke width.
          if (Math.hypot(...h) <= 4 + 1e-12) point(add(p, h, r));
        }
      }
      if (!closed)
        for (const end of [false, true]) {
          // Cap direction comes from the whole subpath; zero-length subpaths use the local x axis (SVG).
          const s = ss.flat(),
            p = end ? s.at(-1)! : s[0]!,
            d = tangent(s, end),
            t = add([0, 0], d[0] || d[1] ? d : [1, 0], end ? 1 : -1),
            n = normal(t);
          if (paint?.cap === 'round') arc(p, r, n, add([0, 0], n, -1), -1);
          else if (paint?.cap === 'square') {
            point(add(add(p, t, r), n, r));
            point(add(add(p, t, r), n, -r));
          }
        }
    }
    matrix = original;
  };
  for (const p of node.paints.filter((p) => p.visible)) {
    let g = p.geometry ?? node.geometry;
    if (!g) continue;
    if (p.trim && p.trim.end - p.trim.start < 1)
      g = {
        kind: 'path',
        d: trimPolys(
          polylines(geometryPath(g)).map((pts) => ({ pts: pts.flat(), closed: false })),
          p.trim.start + p.trim.offset,
          p.trim.end - p.trim.start,
        )
          .map(({ pts }) =>
            Array.from(
              { length: pts.length / 2 },
              (_, i) => (i ? 'L' : 'M') + pts.slice(i * 2, i * 2 + 2).join(' '),
            ).join(''),
          )
          .join(''),
      };
    const begin = points.length;
    path(g, p);
    const f = p.feather;
    if (f?.enabled && points.length > begin) {
      const b = extent(points.splice(begin));
      const r = f.outer;
      const [dx, dy] = apply([matrix[0], matrix[1], matrix[2], matrix[3], 0, 0], ...f.offset);
      const rx = r * (f.space === 'world' ? 1 : Math.hypot(matrix[0], matrix[2]));
      const ry = r * (f.space === 'world' ? 1 : Math.hypot(matrix[1], matrix[3]));
      points.push(
        [b[0] + Math.min(0, dx - rx), b[1] + Math.min(0, dy - ry)],
        [b[0] + b[2] + Math.max(0, dx + rx), b[1] + b[3] + Math.max(0, dy + ry)],
      );
    }
  }
  if (!node.paints.length && node.geometry) path(node.geometry);
  if (!points.length) return;
  return extent(points);
}
function extent(points: Pt[]): Box {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    x = Math.min(...xs),
    y = Math.min(...ys);
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}
export function installPaintedBounds(
  target: typeof runtime,
  modules?: ReadonlyMap<string, import('../../../packages/core/src/modules.ts').Module>,
) {
  boundsScales ??= new WeakMap();
  if (target.bounds === paintedBounds) return;
  target.bounds = paintedBounds;
  let previous = target.refine;
  const refine = (entries: Entry[]) => {
    previous?.(entries);
    const scale = (entries[0] && boundsScales.get(entries[0].p)) ?? [1, 1];
    const drawing = (e: Entry) => {
      const n = drawFrame(e.p).nodes[e.i]!;
      const contour = modules?.get('contour') as
        typeof import('../../contour/core/effects.ts').effects | undefined;
      return {
        ...n,
        paints: n.paints.map((p) => ({
          ...p,
          geometry:
            contour?.undashed(
              n.geometry!,
              (p.key ?? p.kind).split('.').reduce((o, k) => o?.[k], e.p.model.nodes[e.i]!.raw),
              e.p.model.doc.effects,
            ) ?? p.geometry,
        })),
      };
    };
    const children = (e: Entry) => entries.filter((c) => c.parent === e.id);
    const union = (boxes: (Box | undefined)[]) => {
      const points = boxes.flatMap((b): Pt[] =>
        b
          ? [
              [b[0], b[1]],
              [b[0] + b[2], b[1] + b[3]],
            ]
          : [],
      );
      return points.length ? extent(points) : undefined;
    };
    const intersect = (a: Box | undefined, b: Box | undefined): Box | undefined => {
      if (!a || !b) return a && [a[0], a[1], 0, 0];
      const x = Math.max(a[0], b[0]),
        y = Math.max(a[1], b[1]);
      return [
        x,
        y,
        Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - x),
        Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - y),
      ];
    };
    const limits = new Map<Entry, Box | undefined>();
    const restrict = (e: Entry, box: Box | undefined, remember = false): Box | undefined => {
      const n = drawing(e);
      for (const ref of [n.clip, n.mask?.mode.startsWith('inverted') ? undefined : n.mask]) {
        if (!ref) continue;
        const src = entries.find((s) => s.p === e.p && s.i === ref.source);
        const b = src && source(src, ref === n.clip);
        if (remember) limits.set(e, limits.has(e) ? intersect(limits.get(e), b) : b);
        box = intersect(box, b);
      }
      return box;
    };
    const source = (e: Entry, geometry = false): Box | undefined => {
      const n = drawing(e);
      if (!geometry && !n.visible) return;
      const box =
        String(e.p.model.nodes[e.i]!.type) === 'text'
          ? e.bounds
          : union([
              geometry || n.paints.length
                ? paintedBounds(geometry ? { ...n, paints: [] } : n, e.matrix, scale)
                : undefined,
              ...children(e).map((c) => source(c, geometry)),
            ]);
      return geometry ? box : restrict(e, box);
    };
    for (const e of [...entries].reverse()) {
      const n = drawing(e);
      if (!e.config?.bounds && n.geometry && String(e.p.model.nodes[e.i]!.type) !== 'text')
        e.bounds = paintedBounds(n, e.matrix, scale as [number, number]);
      if (!e.bounds)
        e.bounds = union(
          children(e)
            .filter((c) => c.visible)
            .map((c) => c.bounds),
        );
      const clipped = restrict(e, e.bounds, true);
      if (!e.config?.bounds) e.bounds = clipped;
    }
    // Parent clipping also limits descendants exposed as independent semantic nodes.
    for (const e of entries) {
      const parent = entries.find((p) => p.id === e.parent);
      if (parent && limits.has(parent)) {
        const b = limits.get(parent);
        if (!e.config?.bounds) e.bounds = intersect(e.bounds, b);
        limits.set(e, limits.has(e) ? intersect(limits.get(e), b) : b);
      }
    }
  };
  // text-input may register after this calculator; preserve its refinement before ours.
  Object.defineProperty(target, 'refine', {
    configurable: true,
    get: () => refine,
    set: (fn: typeof previous) => {
      previous = fn;
      target.version = (target.version ?? 0) + 1;
    },
  });
}
