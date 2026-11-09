import type { Module } from '../../../packages/core/src/modules.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { C, L, M, Z, parsePath, type Subpath } from '../../../packages/core/src/path.ts';

type Point = [number, number];
type Sample = [number, number, number, number];
export interface PathMeasure {
  closed: boolean;
  at(fraction: number): Sample | undefined;
}

interface Piece {
  a: Point;
  b: Point;
  end: number;
}

const cache = new WeakMap<Player, Map<number, [string, PathMeasure | undefined]>>();
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function table(paths: Subpath[], closed: boolean): PathMeasure {
  const pieces: Piece[] = [];
  let total = 0;
  const line = (a: Point, b: Point, length = dist(a, b)) => {
    if (length) pieces.push({ a, b, end: (total += length) });
  };
  const cubic = (a: Point, b: Point, c: Point, d: Point, depth: number) => {
    const chord = dist(a, d),
      polygon = dist(a, b) + dist(b, c) + dist(c, d);
    if (depth === 20 || polygon - chord <= 0.0001) return line(a, d, (polygon + chord) / 2);
    const ab = mid(a, b),
      bc = mid(b, c),
      cd = mid(c, d),
      abc = mid(ab, bc),
      bcd = mid(bc, cd),
      centre = mid(abc, bcd);
    cubic(a, ab, abc, centre, depth + 1);
    cubic(centre, bcd, cd, d, depth + 1);
  };
  for (const path of paths) {
    let at: Point = [0, 0],
      start = at;
    for (let i = 0; i < path.segs.length;) {
      const op = path.segs[i++]!;
      if (op === Z) {
        line(at, start);
        at = start;
        continue;
      }
      const end = path.segs.slice(i + (op === C ? 4 : 0), i + (op === C ? 6 : 2)) as Point;
      if (op === M) start = end;
      else if (op === C)
        cubic(
          at,
          path.segs.slice(i, i + 2) as Point,
          path.segs.slice(i + 2, i + 4) as Point,
          end,
          0,
        );
      else if (op === L) line(at, end);
      at = end;
      i += op === C ? 6 : 2;
    }
  }
  return {
    closed,
    at(fraction) {
      if (!pieces.length || !total) return;
      const f = closed ? ((fraction % 1) + 1) % 1 : Math.max(0, Math.min(1, fraction)),
        target = f * total;
      let previous = 0,
        piece = pieces[pieces.length - 1]!;
      for (const candidate of pieces)
        if (target <= candidate.end) {
          piece = candidate;
          break;
        } else previous = candidate.end;
      const span = piece.end - previous,
        t = span ? (target - previous) / span : 0,
        dx = piece.b[0] - piece.a[0],
        dy = piece.b[1] - piece.a[1];
      return [piece.a[0] + dx * t, piece.a[1] + dy * t, dx, dy];
    },
  };
}

function primitive(
  cx: number,
  cy: number,
  radius: number,
  from: number,
  sweep: number,
  closed: boolean,
): PathMeasure {
  return {
    closed,
    at(fraction) {
      if (!(radius > 0) || !(sweep > 0)) return;
      const f = closed ? ((fraction % 1) + 1) % 1 : Math.max(0, Math.min(1, fraction)),
        angle = ((from + sweep * f) * Math.PI) / 180,
        sign = sweep < 0 ? -1 : 1;
      return [
        cx + radius * Math.cos(angle),
        cy + radius * Math.sin(angle),
        -Math.sin(angle) * sign,
        Math.cos(angle) * sign,
      ];
    },
  };
}

function roundedRect(x: number, y: number, w: number, h: number, radius: number): string {
  const rx = Math.min(radius, w / 2),
    ry = Math.min(radius, h / 2);
  if (!(rx > 0 && ry > 0)) return `M${x} ${y}L${x + w} ${y}L${x + w} ${y + h}L${x} ${y + h}Z`;
  return `M${x + rx} ${y}L${x + w - rx} ${y}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}L${x + w} ${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}L${x + rx} ${y + h}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}L${x} ${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
}

function fromPolys(polys: { pts: number[]; closed: boolean }[]): PathMeasure | undefined {
  const paths: Subpath[] = [];
  for (const poly of polys) {
    if (poly.pts.length < 2) continue;
    const segs = [M, poly.pts[0]!, poly.pts[1]!];
    for (let i = 2; i < poly.pts.length; i += 2) segs.push(L, poly.pts[i]!, poly.pts[i + 1]!);
    if (poly.closed) segs.push(Z);
    paths.push({ start: 0, end: 0, absolute: true, segs });
  }
  if (!paths.length) return;
  return table(paths, paths.length === 1 && polys[0]!.closed);
}

/** Private measurement used only by the pathfollow runtime. */
export function pathMeasure(
  player: Player,
  node: number,
  outlineModules: readonly Module[] = [],
): PathMeasure | undefined {
  const n = player.model.nodes[node];
  if (!n) return;
  const r = n.raw,
    value = (key: string, fallback = 0) => player.num(node, key, fallback);
  let key = String(n.type),
    measured: PathMeasure | undefined;
  if (n.type === 'circle') {
    const radius = value('r');
    key += `:${radius}`;
    measured = primitive(r.center[0], r.center[1], radius, 0, 360, true);
  } else if (n.type === 'arc') {
    const radius = value('r'),
      from = value('from'),
      sweep = Math.min(360, Math.max(0, value('to') - from));
    key += `:${radius}:${from}:${sweep}`;
    measured = primitive(r.center[0], r.center[1], radius, from, sweep, false);
  } else if (n.type === 'rect') {
    const w = value('w'),
      h = value('h'),
      rx = value('rx');
    key += `:${w}:${h}:${rx}:${r.x0}:${r.y0}`;
    measured = table(parsePath(roundedRect(r.x0, r.y0, w, h, rx)), true);
  } else if (n.type === 'path') {
    const current = player.value(n.id + '.d'),
      d = typeof current === 'string' ? current : n.d;
    if (d) {
      key += ':' + d;
      const paths = parsePath(d);
      measured = table(paths, paths.length === 1 && paths[0]!.segs.at(-1) === Z);
    }
  } else if ((n.type as string) === 'contour') {
    key += ':' + player.drawVersions[node];
    for (const module of outlineModules) {
      const polys = module.outline?.(player, node);
      if ((measured = polys && fromPolys(polys))) break;
    }
  }
  const entries = cache.get(player) ?? new Map<number, [string, PathMeasure | undefined]>(),
    hit = entries.get(node);
  if (!cache.has(player)) cache.set(player, entries);
  if (hit?.[0] === key) return hit[1];
  entries.set(node, [key, measured]);
  return measured;
}
