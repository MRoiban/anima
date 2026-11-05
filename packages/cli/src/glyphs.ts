// Tooling geometry from core's normalized absolute M/L/C/Z segments.
import { parsePath, type Subpath } from '@anima-format/core';

type BBox = [number, number, number, number]; // minX, minY, maxX, maxY, grid units

function bounds({ segs }: Subpath): BBox {
  const box: BBox = [Infinity, Infinity, -Infinity, -Infinity];
  const point = (x: number, y: number) => {
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x);
    box[3] = Math.max(box[3], y);
  };
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0;
  for (let i = 0; i < segs.length;) {
    const op = segs[i++]!;
    if (op === 3) {
      x = sx;
      y = sy;
      continue;
    }
    if (op !== 2) {
      x = segs[i++]!;
      y = segs[i++]!;
      if (op === 0) {
        sx = x;
        sy = y;
      }
      point(x, y);
      continue;
    }
    const [x1, y1, x2, y2, ex, ey] = segs.slice(i, (i += 6)) as [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    const roots = (a: number, b: number, c: number, d: number): number[] => {
      // derivative / 3 = A*t² + B*t + C
      const A = -a + 3 * b - 3 * c + d,
        B = 2 * (a - 2 * b + c),
        C = b - a;
      if (Math.abs(A) < 1e-12) return Math.abs(B) < 1e-12 ? [] : [-C / B];
      const disc = B * B - 4 * A * C;
      return disc < 0 ? [] : [(-B + Math.sqrt(disc)) / (2 * A), (-B - Math.sqrt(disc)) / (2 * A)];
    };
    const at = (a: number, b: number, c: number, d: number, t: number) =>
      (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d;
    for (const t of [...roots(x, x1, x2, ex), ...roots(y, y1, y2, ey)])
      if (t > 0 && t < 1) point(at(x, x1, x2, ex, t), at(y, y1, y2, ey, t));
    point(ex, ey);
    x = ex;
    y = ey;
  }
  return box;
}

export function inspectGlyph(d: string) {
  // Rounded to 0.001 grid units: enough to tell parts apart, free of float noise.
  const boxes = parsePath(d).map((s) => bounds(s).map((v) => Math.round(v * 1000) / 1000 || 0));
  return boxes.map((bbox, index) => ({
    index,
    bbox,
    // Containment alone cannot prove a hole (winding and intersecting outlines matter).
    likelyHoleOf: boxes.flatMap((outer, j) =>
      j !== index &&
      outer[0] <= bbox[0] &&
      outer[1] <= bbox[1] &&
      outer[2] >= bbox[2] &&
      outer[3] >= bbox[3] &&
      outer.some((v, k) => v !== bbox[k])
        ? [j]
        : [],
    ),
  }));
}
