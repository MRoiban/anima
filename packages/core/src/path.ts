// SVG 1.1 path data: full grammar in, absolute M/L/C/Z out, split by subpath (spec §3).

import { VERBOSE as V } from './flags.ts';

/** Segment opcodes in `Subpath.segs`: M x y, L x y, C x1 y1 x2 y2 x y, Z. */
export const M = 0;
export const L = 1;
export const C = 2;
export const Z = 3;

export interface Subpath {
  /** Source text range [start, end) of this subpath in the original `d`. */
  start: number;
  end: number;
  /** True when the source slice can stand alone (it starts with an absolute `M`). */
  absolute: boolean;
  /** Flat list: opcode followed by its absolute coordinates. */
  segs: number[];
}

export class PathError extends Error {
  readonly at: number;
  constructor(message: string, at: number) {
    super(message);
    this.at = at;
  }
}

const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

/** Parse path data. Throws `PathError` with the offending offset. */
export function parsePath(d: string): Subpath[] {
  const out: Subpath[] = [];
  let i = 0;
  const n = d.length;
  const fail = (message: string, at = i): never => {
    throw new PathError(message, at);
  };
  const ws = () => {
    while (i < n && /[\s,]/.test(d[i]!)) i++;
  };
  const num = (): number => {
    ws();
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i, i + 40));
    if (!m) return fail(V ? 'expected a number' : '');
    i += m[0].length;
    return Number(m[0]);
  };
  const flag = (): number => {
    ws();
    const c = d[i++];
    return c === '0' || c === '1' ? +c : fail(V ? 'expected an arc flag (0 or 1)' : '', i - 1);
  };

  let cur: Subpath | undefined;
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0; // pen, subpath start
  let cx = 0,
    cy = 0; // last control point, for S/T reflection
  let prev = ''; // previous command (lowercase), for S/T
  let cmd = '';

  const seg = (op: number, ...v: number[]) => cur!.segs.push(op, ...v);

  ws();
  while (i < n) {
    const ch = d[i]!;
    if (/[a-z]/i.test(ch)) {
      if (!(ch.toLowerCase() in ARGS)) fail(V ? `unknown command "${ch}"` : '');
      cmd = ch;
      i++;
    } else if (!cmd) fail(V ? 'path data must start with a moveto' : '');
    else if (cmd === 'z' || cmd === 'Z') fail(V ? 'closepath takes no arguments' : '');
    const lc = cmd.toLowerCase();
    const rel = cmd === lc;
    if (!cur && lc !== 'm') fail(V ? 'path data must start with a moveto' : '', i - 1);
    const start = i - 1; // a moveto's letter
    const a: number[] = [];
    for (let k = 0; k < ARGS[lc]!; k++) a.push(lc === 'a' && (k === 3 || k === 4) ? flag() : num());
    // Make the coordinates absolute: pairs, except h (x), v (y) and the arc's end point.
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (lc === 'a') {
      a[5]! += ox;
      a[6]! += oy;
    } else if (lc === 'v') a[0]! += oy;
    else a.forEach((v, k) => (a[k] = v + (k % 2 ? oy : ox)));
    // S and T become C and Q with the reflected (or current) point as first control.
    if (lc === 's' || lc === 't')
      a.unshift(...((lc === 's' ? /[cs]/ : /[qt]/).test(prev) ? [2 * x - cx, 2 * y - cy] : [x, y]));
    if (lc === 'm') {
      if (cur) cur.end = start;
      cur = { start, end: n, absolute: !rel, segs: [] };
      out.push(cur);
      seg(M, (x = sx = a[0]!), (y = sy = a[1]!));
      cmd = rel ? 'l' : 'L'; // implicit lineto after moveto
    } else if (lc === 'z') {
      seg(Z);
      x = sx;
      y = sy;
    } else if (lc === 'c' || lc === 's') {
      seg(C, ...a);
      [cx, cy, x, y] = a.slice(2) as [number, number, number, number];
    } else if (lc === 'q' || lc === 't') {
      const [qx, qy, ex, ey] = a as [number, number, number, number];
      seg(
        C,
        x + (2 / 3) * (qx - x),
        y + (2 / 3) * (qy - y),
        ex + (2 / 3) * (qx - ex),
        ey + (2 / 3) * (qy - ey),
        ex,
        ey,
      );
      [cx, cy, x, y] = a as [number, number, number, number];
    } else if (lc === 'a') {
      arcToCubics(x, y, a, cur!.segs);
      x = a[5]!;
      y = a[6]!;
    } else {
      // l, h, v
      if (lc === 'h') a.push(y);
      if (lc === 'v') a.unshift(x);
      seg(L, (x = a[0]!), (y = a[1]!));
    }
    prev = lc === 'm' ? 'l' : lc;
    ws();
  }
  if (!out.length) fail(V ? 'empty path data' : '', 0);
  return out;
}

/** Endpoint arc (rx ry phi large-arc sweep x2 y2) to cubic Béziers (SVG 1.1 F.6.5), at most 90° per piece. */
function arcToCubics(x1: number, y1: number, arc: number[], segs: number[]): void {
  const [, , phiDeg, fa, fs, x2, y2] = arc as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  let rx = Math.abs(arc[0]!);
  let ry = Math.abs(arc[1]!);
  if ((x1 === x2 && y1 === y2) || !rx || !ry) {
    if (x1 !== x2 || y1 !== y2) segs.push(L, x2, y2);
    return;
  }
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy;
  const yp = -sin * dx + cos * dy;
  const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const den = rx * rx * yp * yp + ry * ry * xp * xp;
  const k = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (k * rx * yp) / ry;
  const cyp = (-k * ry * xp) / rx;
  const ccx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const ccy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI;
  if (fs && dt < 0) dt += 2 * Math.PI;
  const pieces = Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9);
  const step = dt / pieces;
  const kk = (4 / 3) * Math.tan(step / 4);
  const pt = (t: number): [number, number, number, number] => {
    const c = Math.cos(t),
      s = Math.sin(t);
    // point and derivative on the ellipse, rotated by phi
    return [
      ccx + rx * c * cos - ry * s * sin,
      ccy + rx * c * sin + ry * s * cos,
      -rx * s * cos - ry * c * sin,
      -rx * s * sin + ry * c * cos,
    ];
  };
  for (let p = 0; p < pieces; p++) {
    const a = pt(t1 + p * step);
    const b = pt(t1 + (p + 1) * step);
    const end = p === pieces - 1 ? [x2, y2] : [b[0], b[1]];
    segs.push(
      C,
      a[0] + kk * a[2],
      a[1] + kk * a[3],
      b[0] - kk * b[2],
      b[1] - kk * b[3],
      end[0]!,
      end[1]!,
    );
  }
}

const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4 || 0);

/** Serialise subpaths to absolute M/L/C/Z path data. */
export function formatSegs(subpaths: Subpath[]): string {
  let s = '';
  for (const sp of subpaths) {
    const g = sp.segs;
    for (let i = 0; i < g.length;) {
      const op = g[i++]!;
      const k = op === C ? 6 : op === Z ? 0 : 2;
      s +=
        'MLCZ'[op]! +
        g
          .slice(i, i + k)
          .map(fmt)
          .join(' ');
      i += k;
    }
  }
  return s;
}

/**
 * Path data for a selection of subpaths. When every selected subpath can stand alone in the
 * source, the result is made of source slices, so selecting all of a Glyphy path returns its
 * `d` byte for byte (spec §1.2).
 */
export function selectPath(d: string, all: Subpath[], pick?: readonly number[]): string {
  return selectSubpaths(d, all, pick).d;
}

/** Resolve geometry and source-preserving path data together, sorting the selection once. */
export function selectSubpaths(
  d: string,
  all: Subpath[],
  pick?: readonly number[],
): { geom: Subpath[]; d: string } {
  const geom = pick ? [...pick].sort((a, b) => a - b).map((i) => all[i]!) : all;
  return {
    geom,
    d:
      geom.length === all.length
        ? d
        : geom.every((sp) => sp.absolute)
          ? geom.map((sp) => d.slice(sp.start, sp.end).trim()).join('')
          : formatSegs(geom),
  };
}

/**
 * Flatten subpaths into closed polylines (for hit testing): one flat [x0, y0, x1, y1, …] array per
 * subpath, curves subdivided into `steps` chords.
 */
export function flatten(subpaths: Subpath[], steps = 12): { pts: number[]; closed: boolean }[] {
  const out: { pts: number[]; closed: boolean }[] = [];
  for (const sp of subpaths) {
    const g = sp.segs;
    let pts: number[] = [];
    let closed = false;
    let x = 0,
      y = 0;
    for (let i = 0; i < g.length;) {
      const op = g[i++]!;
      if (op === M) {
        if (pts.length) out.push({ pts, closed });
        pts = [(x = g[i++]!), (y = g[i++]!)];
        closed = false;
      } else if (op === L) {
        pts.push((x = g[i++]!), (y = g[i++]!));
      } else if (op === C) {
        const [x1, y1, x2, y2, x3, y3] = g.slice(i, (i += 6)) as [
          number,
          number,
          number,
          number,
          number,
          number,
        ];
        for (let k = 1; k <= steps; k++) {
          const t = k / steps,
            r = 1 - t;
          pts.push(
            r * r * r * x + 3 * r * r * t * x1 + 3 * r * t * t * x2 + t * t * t * x3,
            r * r * r * y + 3 * r * r * t * y1 + 3 * r * t * t * y2 + t * t * t * y3,
          );
        }
        x = x3;
        y = y3;
      } else {
        closed = true;
      }
    }
    if (pts.length) out.push({ pts, closed });
  }
  return out;
}

/**
 * Natural outline length in local grid units. Cubics use de Casteljau subdivision until
 * control-polygon length minus chord ≤ tolerance (0.0001 grid units), or depth 20.
 * Each accepted chord uses (polygon + chord)/2. Arcs use parsePath's ≤90° cubic conversion.
 */
export function pathLength(d: string, tolerance = 0.0001): number {
  const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
  const mid = (a: number[], b: number[]) => [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];
  const cubic = (a: number[], b: number[], c: number[], e: number[], depth: number): number => {
    const chord = dist(a, e),
      polygon = dist(a, b) + dist(b, c) + dist(c, e);
    if (depth === 20 || polygon - chord <= tolerance) return (polygon + chord) / 2;
    const ab = mid(a, b),
      bc = mid(b, c),
      ce = mid(c, e),
      abc = mid(ab, bc),
      bce = mid(bc, ce),
      centre = mid(abc, bce);
    return cubic(a, ab, abc, centre, depth + 1) + cubic(centre, bce, ce, e, depth + 1);
  };
  let total = 0;
  for (const sp of parsePath(d)) {
    let at = [0, 0],
      start = at;
    for (let i = 0; i < sp.segs.length;) {
      const op = sp.segs[i++]!;
      if (op === Z) {
        total += dist(at, start);
        at = start;
        continue;
      }
      const end = sp.segs.slice(i + (op === C ? 4 : 0), i + (op === C ? 6 : 2));
      if (op === M) start = end;
      else
        total +=
          op === C
            ? cubic(at, sp.segs.slice(i, i + 2), sp.segs.slice(i + 2, i + 4), end, 0)
            : dist(at, end);
      at = end;
      i += op === C ? 6 : 2;
    }
  }
  return total;
}
