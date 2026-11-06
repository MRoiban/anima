import { cubic, elastic, type EaseFn } from '../../../packages/core/src/ease.ts';

const number = String.raw`\s*(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*`;
const elasticRE = new RegExp(`^elastic-(in|in-out)\\(${number},${number}\\)$`);
const valueRE = new RegExp(`^value-cubic\\(${number},${number},${number},${number}\\)$`);
export function motionEase(src: string): EaseFn | string | undefined {
  const m = elasticRE.exec(src);
  if (!m)
    return src.startsWith('elastic-') ? 'use elastic-in(a,p) or elastic-in-out(a,p)' : undefined;
  const a = Number(m[2]),
    p = Number(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(p) || a < 0 || p <= 0)
    return 'elastic needs finite a ≥ 0 and p > 0';
  const out = elastic(a, p);
  const inward = (u: number) => 1 - out(1 - u);
  return m[1] === 'in' ? inward : (u) => (u < 0.5 ? inward(2 * u) / 2 : 0.5 + out(2 * u - 1) / 2);
}
export function valueCurve(src: string, a: number, b: number): EaseFn | string | undefined {
  const m = valueRE.exec(src);
  if (!m) return undefined;
  const [x1, y1, x2, y2] = m.slice(1).map(Number) as [number, number, number, number];
  if (![x1, y1, x2, y2].every(Number.isFinite) || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1)
    return 'value-cubic needs finite values and time handles in [0,1]';
  // Reuse the existing monotone x solver to return its parameter, then evaluate values directly.
  const parameter = cubic(x1, 1 / 3, x2, 2 / 3);
  return (u) => {
    const s = parameter(u),
      r = 1 - s;
    return r * r * r * a + 3 * r * r * s * y1 + 3 * r * s * s * y2 + s * s * s * b;
  };
}
