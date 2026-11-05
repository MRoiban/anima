// 2D affine matrices [a, b, c, d, e, f] (x' = a·x + c·y + e, y' = b·x + d·y + f), and hit tests.

export type Mat = [number, number, number, number, number, number];

/** Clamp a numeric value to inclusive bounds. */
export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** Spec §4: T(x, y) · T(px, py) · R(rotate) · S(sx, sy) · T(−px, −py). */
export function localMatrix(
  x: number,
  y: number,
  px: number,
  py: number,
  deg: number,
  sx: number,
  sy: number,
): Mat {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const a = cos * sx;
  const b = sin * sx;
  const c = -sin * sy;
  const d = cos * sy;
  return [a, b, c, d, x + px - a * px - c * py, y + py - b * px - d * py];
}

export function invert(m: Mat): Mat | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det) return null;
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}

export const apply = (m: Mat, x: number, y: number): [number, number] => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/** Point in closed polylines by fill rule. */
export function inside(polys: number[][], x: number, y: number, evenodd: boolean): boolean {
  let wind = 0;
  for (const p of polys) {
    const n = p.length;
    for (let i = 0; i < n; i += 2) {
      const x0 = p[i]!,
        y0 = p[i + 1]!;
      const x1 = p[(i + 2) % n]!,
        y1 = p[(i + 3) % n]!;
      if (y0 <= y ? y1 > y : y1 <= y) {
        const t = x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
        if (t > x) wind += y1 > y0 ? 1 : -1;
      }
    }
  }
  return evenodd ? wind % 2 !== 0 : wind !== 0;
}

/** Distance from a point to polylines (closed ones include their closing edge). */
export function distance(
  polys: { pts: number[]; closed: boolean }[],
  x: number,
  y: number,
): number {
  let best = Infinity;
  for (const { pts, closed } of polys) {
    const n = pts.length;
    const last = closed ? n : n - 2;
    if (n === 2) best = Math.min(best, Math.hypot(x - pts[0]!, y - pts[1]!));
    for (let i = 0; i < last; i += 2) {
      const x0 = pts[i]!,
        y0 = pts[i + 1]!;
      const x1 = pts[(i + 2) % n]!,
        y1 = pts[(i + 3) % n]!;
      const dx = x1 - x0,
        dy = y1 - y0;
      const l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(x - x0 - t * dx, y - y0 - t * dy));
    }
  }
  return best;
}
