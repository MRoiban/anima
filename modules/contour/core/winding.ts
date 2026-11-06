// Positive winding expressed as a union of trapezoids; backends use ordinary nonzero fill.
// Coordinates use the SVG y-down convention, so clockwise contributes positive winding.
import { polylines, geometryPath } from './effects.ts';
import { inside } from '../../../packages/core/src/geom.ts';
import { fmt } from '../../../packages/core/src/draw.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
type Edge = { x: number; y: number; dx: number; dy: number };
export function clockwisePath(d: string): string {
  const edges: Edge[] = [],
    ys: number[] = [];
  for (const line of polylines(d)) {
    for (let i = 0; i < line.length; i++) {
      const a = line[i]!,
        b = line[(i + 1) % line.length]!;
      ys.push(a[1]);
      if (a[1] === b[1]) continue;
      edges.push({ x: a[0], y: a[1], dx: b[0] - a[0], dy: b[1] - a[1] });
    }
  }
  const at = (e: Edge, y: number) => e.x + ((y - e.y) * e.dx) / e.dy;
  const active = (e: Edge, y: number) =>
    y > Math.min(e.y, e.y + e.dy) && y < Math.max(e.y, e.y + e.dy);
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i]!,
        b = edges[j]!,
        slope = a.dx / a.dy - b.dx / b.dy;
      if (!slope) continue;
      const y = (b.x - (b.y * b.dx) / b.dy - a.x + (a.y * a.dx) / a.dy) / slope;
      if (active(a, y) && active(b, y)) ys.push(y);
    }
  const levels = [...new Set(ys)].sort((a, b) => a - b);
  let out = '';
  for (let i = 1; i < levels.length; i++) {
    const low = levels[i - 1]!,
      high = levels[i]!,
      mid = (low + high) / 2;
    const crossings = edges.filter((e) => active(e, mid)).sort((a, b) => at(a, mid) - at(b, mid));
    let wind = 0,
      left: Edge | undefined;
    for (const e of crossings) {
      const before = wind;
      wind -= Math.sign(e.dy);
      if (before <= 0 && wind > 0) left = e;
      if (before > 0 && wind <= 0 && left) {
        const coords = [
          [at(left, low), low],
          [at(e, low), low],
          [at(e, high), high],
          [at(left, high), high],
        ];
        out += coords.map((p, j) => (j ? 'L' : 'M') + p.map(fmt).join(' ')).join('') + 'Z';
        left = undefined;
      }
    }
  }
  return out;
}
export const winding: Module = {
  name: 'contour',
  entries: [
    {
      target: 'fill',
      shapes: { winding: { k: 'str', of: ['clockwise'], markup: 'fill-winding' } },
    },
  ],
  fillContains(p, i, outline, x, y) {
    const raw = p.model.nodes[i]!.raw;
    const fills = raw.paints
      ?.map((paint: { fill?: { winding?: string; rule?: string } }) => paint.fill)
      .filter(Boolean) ?? [raw.fill];
    if (!fills.some((fill: { winding?: string } | undefined) => fill?.winding === 'clockwise'))
      return;
    let wind = 0;
    for (const { pts } of outline)
      for (let j = 0; j < pts.length; j += 2) {
        const x0 = pts[j]!,
          y0 = pts[j + 1]!,
          x1 = pts[(j + 2) % pts.length]!,
          y1 = pts[(j + 3) % pts.length]!;
        if ((y0 <= y ? y1 > y : y1 <= y) && x0 + ((y - y0) / (y1 - y0)) * (x1 - x0) > x)
          wind += y1 > y0 ? 1 : -1;
      }
    return fills.some(
      (fill: { winding?: string; rule?: string } | undefined) =>
        fill &&
        (fill.winding === 'clockwise'
          ? wind > 0
          : inside(
              outline.filter((p) => p.closed).map((p) => p.pts),
              x,
              y,
              fill.rule === 'evenodd',
            )),
    );
  },
  draw: {
    frame(p, i, data) {
      if (!data.geometry) return;
      for (const paint of data.paints) {
        if (paint.kind !== 'fill') continue;
        const raw = (paint.key ?? paint.kind)
          .split('.')
          .reduce((o, k) => o?.[k], p.model.nodes[i]!.raw);
        if (raw?.winding === 'clockwise') {
          paint.geometry = { kind: 'path', d: clockwisePath(geometryPath(data.geometry)) };
          paint.rule = 'nonzero';
        }
      }
    },
  },
};
