import type { TimelineM } from '../../../packages/core/src/load.ts';
import type { AnimaEvent } from '../../../packages/core/src/player.ts';

export type Loop = TimelineM['loop'];
export interface Timing {
  speed?: number;
  quantize?: number;
  work?: [number, number];
}
export const timing = new WeakMap<TimelineM, Timing>();
export const bounds = (t: TimelineM): [number, number] => timing.get(t)?.work ?? [0, t.duration];
export function position(
  t: TimelineM,
  clock: number,
  loop: Loop = t.loop,
  quantize = true,
): number {
  const [start, end] = bounds(t),
    d = end - start;
  let x = clock - start;
  if (loop === 'once') x = Math.max(0, Math.min(d, x));
  else {
    const period = loop === 'loop' ? d : d * 2;
    x -= period * Math.floor(x / period);
    if (x > d) x = period - x;
  }
  let at = start + x;
  const q = timing.get(t)?.quantize;
  if (quantize && q && at !== end) at = Math.max(start, Math.floor(at * q) / q);
  return at;
}
/** Source clock, before work-area folding and sample quantization. */
export function clock(t: TimelineM, elapsed: number, stateSpeed = 1): number {
  const speed = stateSpeed * (timing.get(t)?.speed ?? 1);
  const [a, b] = bounds(t);
  return (speed < 0 ? b : a) + elapsed * speed;
}
export const duration = (t: TimelineM, speed: number) => {
  const [a, b] = bounds(t);
  return (b - a) / Math.abs(speed * (timing.get(t)?.speed ?? 1));
};

/** Half-open crossings, stable by authored event order for coincident events. */
export function crossings(
  t: TimelineM,
  a: number,
  b: number,
  closed: boolean,
  layer: string,
  out: AnimaEvent[],
  loop: Loop = t.loop,
): void {
  const [start, end] = bounds(t),
    d = end - start;
  const reverse = b < a;
  const lo = Math.min(a, b),
    hi = Math.max(a, b);
  const period = loop === 'pingpong' ? 2 * d : d;
  const found: [number, number, string][] = [];
  for (const [at, name] of t.events) {
    if (at < start || at > end) continue;
    const first = loop === 'once' ? 0 : Math.floor((lo - start) / period) - 1;
    const last =
      loop === 'once' ? 0 : Math.min(first + 10000, Math.ceil((hi - start) / period) + 1);
    const seen = new Set<number>();
    for (let k = first; k <= last; k++) {
      for (const x of loop === 'pingpong'
        ? [at + k * period, 2 * end - at + k * period]
        : [at + k * period]) {
        const hit = reverse
          ? x >= b && (closed ? x <= a : x < a)
          : x <= b && (closed ? x >= a : x > a);
        if (hit && !seen.has(x)) {
          seen.add(x);
          found.push([x, at, name]);
        }
      }
    }
  }
  found.sort((x, y) => (reverse ? y[0] - x[0] : x[0] - y[0]));
  for (const [, time, name] of found) out.push({ name, layer, time });
}
