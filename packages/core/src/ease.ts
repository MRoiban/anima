import { VERBOSE as V } from './flags.ts';

/** An ease maps segment progress u ∈ [0, 1] to a weight w (spec §5). */
export type EaseFn = (u: number) => number;

const NUM = '\\s*(-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?)\\s*';
const CUBIC = new RegExp(`^cubic\\(${NUM},${NUM},${NUM},${NUM}\\)$`);
const ELASTIC = new RegExp(`^elastic\\(${NUM},${NUM}\\)$`);

export const linear: EaseFn = (u) => u;
export const hold: EaseFn = () => 0;

/** CSS cubic-bezier through (0,0) (x1,y1) (x2,y2) (1,1). */
export function cubic(x1: number, y1: number, x2: number, y2: number): EaseFn {
  const bez = (s: number, p1: number, p2: number) => {
    const r = 1 - s;
    return 3 * r * r * s * p1 + 3 * r * s * s * p2 + s * s * s;
  };
  const dx = (s: number) => {
    const r = 1 - s;
    return 3 * r * r * x1 + 6 * r * s * (x2 - x1) + 3 * s * s * (1 - x2);
  };
  return (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    // Newton from the linear guess; accept only a well-conditioned converged root.
    let s = u;
    for (let i = 0; i < 8; i++) {
      const e = bez(s, x1, x2) - u;
      const d = dx(s);
      if (Math.abs(e) < 1e-12 && d > 1e-3) return bez(s, y1, y2);
      if (d < 1e-6) break;
      s -= e / d;
      if (s < 0 || s > 1) break;
    }
    // Bisection: Bx is non-decreasing on [0, 1] because x1, x2 ∈ [0, 1].
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 48; i++) {
      s = (lo + hi) / 2;
      if (bez(s, x1, x2) < u) lo = s;
      else hi = s;
    }
    return bez((lo + hi) / 2, y1, y2);
  };
}

/** Ease-out elastic with amplitude a and period p (spec §5). */
export function elastic(a: number, p: number): EaseFn {
  const A = Math.max(a, 1);
  const s = (p / (2 * Math.PI)) * Math.asin(1 / A);
  return (u) =>
    u <= 0 ? 0 : u >= 1 ? 1 : A * 2 ** (-10 * u) * Math.sin(((u - s) * 2 * Math.PI) / p) + 1;
}

const NAMED: Record<string, EaseFn> = {
  linear,
  hold,
  in: cubic(0.42, 0, 1, 1),
  out: cubic(0, 0, 0.58, 1),
  inOut: cubic(0.42, 0, 0.58, 1),
};

/** Parse an ease string. Returns the function, or an error message. */
export function parseEase(src: string): EaseFn | string {
  const named = Object.hasOwn(NAMED, src) ? NAMED[src] : undefined;
  if (named) return named;
  let m = CUBIC.exec(src);
  if (m) {
    const [x1, y1, x2, y2] = m.slice(1).map(Number) as [number, number, number, number];
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return V ? 'cubic x1 and x2 must lie in [0, 1]' : '';
    if (!isFinite(y1 + y2)) return V ? 'cubic arguments must be finite' : '';
    return cubic(x1, y1, x2, y2);
  }
  m = ELASTIC.exec(src);
  if (m) {
    const [a, p] = m.slice(1).map(Number) as [number, number];
    if (!(a >= 0 && p > 0 && isFinite(a + p)))
      return V ? 'elastic needs finite a ≥ 0 and p > 0' : '';
    return elastic(a, p);
  }
  return V ? 'not an ease' : '';
}
