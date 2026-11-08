import type { DrawNode, Geometry, DrawPaint } from '../../../packages/core/src/draw.ts';
import { apply, type Mat } from '../../../packages/core/src/geom.ts';
import { parsePath, M, C, Z } from '../../../packages/core/src/path.ts';
import type { runtime } from './runtime.ts';
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
/** Tight standard fill/stroke bounds of the resolved geometry, before clipping/masking. */
export function paintedBounds(
  node: DrawNode,
  matrix: Mat,
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
    const r = paint?.kind === 'stroke' ? (paint.width ?? 1) / 2 : 0;
    if (g.r !== undefined) {
      const center = apply(matrix, g.cx!, g.cy!);
      const radius = g.r + r;
      const x = radius * Math.hypot(matrix[0], matrix[2]),
        y = radius * Math.hypot(matrix[1], matrix[3]);
      points.push([center[0] - x, center[1] - y], [center[0] + x, center[1] + y]);
      return;
    }
    if (!g.d && g.width !== undefined && g.rx) {
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
    const d =
      g.d ?? `M${g.x ?? 0} ${g.y ?? 0}h${g.width ?? 0}v${g.height ?? 0}h${-(g.width ?? 0)}Z`;
    for (const { segs } of parsePath(d)) {
      const ss: Segment[] = [];
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
          const s = end ? ss.at(-1)! : ss[0]!,
            p = end ? s.at(-1)! : s[0]!,
            t = add([0, 0], tangent(s, end), end ? 1 : -1),
            n = normal(t);
          if (paint?.cap === 'round') arc(p, r, n, add([0, 0], n, -1), -1);
          else if (paint?.cap === 'square') {
            point(add(add(p, t, r), n, r));
            point(add(add(p, t, r), n, -r));
          }
        }
    }
  };
  for (const p of node.paints.filter((p) => p.visible))
    if (p.geometry ?? node.geometry) path((p.geometry ?? node.geometry)!, p);
  if (!node.paints.length && node.geometry) path(node.geometry);
  if (!points.length) return;
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    x = Math.min(...xs),
    y = Math.min(...ys);
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}
export function installPaintedBounds(target: typeof runtime) {
  target.bounds = paintedBounds;
}
