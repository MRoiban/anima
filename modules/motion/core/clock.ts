import type { TimelineM } from '../../../packages/core/src/load.ts';
import type { AnimaEvent } from '../../../packages/core/src/player.ts';

import { reached, snapTime, foldTime } from '../../../packages/core/src/time.ts';

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
  const relative = clock - start;
  const x =
    loop === 'once'
      ? Math.max(0, Math.min(d, snapTime(snapTime(relative, 0), d)))
      : foldTime(relative, d, loop === 'pingpong');
  let at = x === d ? end : start + x;
  const q = timing.get(t)?.quantize;
  if (quantize && q && at !== end) {
    const tick = Math.round(at * q) / q;
    at = Math.max(start, snapTime(at, tick) === tick ? tick : Math.floor(at * q) / q);
  }
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
  source = t.events,
): void {
  const [start, end] = bounds(t),
    d = end - start;
  const reverse = b < a;
  const lo = Math.min(a, b),
    hi = Math.max(a, b);
  const period = loop === 'pingpong' ? 2 * d : d;
  const found: [number, number, string][] = [];
  for (const [at, name] of source) {
    if (at < start || at > end) continue;
    const first = loop === 'once' ? 0 : Math.floor((lo - start) / period) - 1;
    const last =
      loop === 'once' ? 0 : Math.min(first + 10000, Math.ceil((hi - start) / period) + 1);
    const seen = new Set<number>();
    for (let k = first; k <= last; k++) {
      // Endpoint turns use one series, even when reflected arithmetic differs by an ulp.
      for (const x of loop === 'pingpong' && at !== start && at !== end
        ? [at + k * period, 2 * end - at + k * period]
        : [at + k * period]) {
        const hit = reverse
          ? reached(x, b) && (closed ? reached(a, x) : !reached(x, a))
          : reached(b, x) && (closed ? reached(x, a) : !reached(a, x));
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
