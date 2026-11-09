import { fmt } from '../../../packages/core/src/draw.ts';
export type Point = [number, number];
const pt = (p: Point) => p.map(fmt).join(' ');
/** Half-edge cutbacks; rects use quarter-ellipse cubics, other polygons use quadratics. */
export function outline(points: Point[], radii: number[], circular = false): string {
  const parts = points.map((v, i) => {
    const prev = points[(i + points.length - 1) % points.length]!;
    const next = points[(i + 1) % points.length]!;
    const cut = (q: Point): Point => {
      const len = Math.hypot(q[0] - v[0], q[1] - v[1]);
      const t = len ? Math.min(0.5, radii[i % radii.length]! / len) : 0;
      return [v[0] + (q[0] - v[0]) * t, v[1] + (q[1] - v[1]) * t];
    };
    return { v, a: cut(prev), b: cut(next) };
  });
  return (
    parts
      .map(
        (q, i) =>
          (i ? 'L' : 'M') +
          pt(q.a) +
          (circular
            ? 'C' +
              pt(q.a.map((v, j) => v + (q.v[j]! - v) * 0.5522847498307936) as Point) +
              ' ' +
              pt(q.b.map((v, j) => v + (q.v[j]! - v) * 0.5522847498307936) as Point)
            : 'Q' + pt(q.v)) +
          ' ' +
          pt(q.b),
      )
      .join('') + 'Z'
  );
}
