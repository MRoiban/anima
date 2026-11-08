import type { Player } from '../../../packages/core/src/player.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { Diags } from '../../../packages/core/src/diag.ts';
import { motionEase } from '../../motion/core/curves.ts';
import { parseEase, type EaseFn } from '../../../packages/core/src/ease.ts';
import { nodePointer } from '../../components/core/node-pointer.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import type { Box } from './algorithm.ts';
function config(value: unknown, motion = false): { duration: number; ease: EaseFn } | undefined {
  const match = /^(\S+)(?:\s+(.+))?$/.exec(String(value));
  const duration = Number(match?.[1]),
    source = match?.[2] ?? 'linear',
    ease = motion ? (motionEase(source) ?? parseEase(source)) : parseEase(source);
  if (duration >= 0 && Number.isFinite(duration) && typeof ease === 'function')
    return { duration, ease };
}
export function validateReflow(model: Model, d: Diags) {
  for (const [i, n] of model.nodes.entries())
    for (const [prefix, raw] of [
      ['', String(n.type) === 'layout' ? n.raw : undefined],
      ['/layout', n.raw.layout],
    ] as const)
      if (raw?.reflow !== undefined && !config(raw.reflow, model.doc.requires?.includes('motion')))
        d.err(
          'layout-reflow',
          nodePointer(model, i) + prefix + '/reflow',
          V ? 'invalid reflow duration or ease' : '',
          V ? 'use a nonnegative duration in seconds followed by a §5 ease, e.g. 0.25 out' : '',
        );
}
export function reflow(p: Player, boxes: Map<number, Box>): Map<number, Box> {
  let state = states.get(p);
  if (!state) {
    states.set(p, (state = { drawn: new Map(), targets: new Map(), flights: new Map() }));
    // Chain any instance-level busy (host data API) and stay configurable for later wrappers.
    const busy = (Object.getOwnPropertyDescriptor(p, 'busy') ??
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(p), 'busy'))!.get!;
    Object.defineProperty(p, 'busy', {
      configurable: true,
      get: () => !!state!.flights.size || busy.call(p),
    });
    const values = p.values;
    p.values = function () {
      const result = values.call(this);
      for (const [i, box] of state!.drawn)
        for (const k of keys) result[this.model.nodes[i]!.id + '.drawnLayoutBox.' + k] = box[k];
      return result;
    };
    const step = p.step;
    p.step = function (dt) {
      const result = step.call(this, dt);
      return { ...result, settled: result.settled && !state!.flights.size };
    };
  }
  const { drawn, targets, flights } = state;
  const settings = (i: number, child = true): ReturnType<typeof config> => {
    if (i < 0) return;
    const n = p.model.nodes[i]!,
      value =
        (child ? n.raw.layout?.reflow : undefined) ??
        (String(n.type) === 'layout' ? n.raw.reflow : undefined);
    return value === undefined
      ? settings(n.parent, false)
      : config(value, p.model.doc.requires?.includes('motion'));
  };
  for (const [i, target] of boxes) {
    let box = drawn.get(i);
    const old = targets.get(i),
      flight = flights.get(i);
    // Advance the old flight first: a change at this step retargets from its current drawn box.
    if (flight) {
      const u = Math.min(1, (p.time - flight.start) / flight.duration),
        w = flight.ease(u);
      box = { ...flight.from };
      for (const k of keys)
        box[k] = Math.max(
          k === 'width' || k === 'height' ? 0 : -Infinity,
          box[k] + (old![k] - box[k]) * w,
        );
      if (u === 1) {
        box = old;
        flights.delete(i);
      }
    }
    if (!old || keys.some((k) => old[k] !== target[k])) {
      const c = settings(i);
      if (box && c?.duration && !p.reducedMotion)
        flights.set(i, { ...c, start: p.time, from: box });
      else {
        box = target;
        flights.delete(i);
      }
      targets.set(i, target);
    }
    if (p.reducedMotion) {
      box = target;
      flights.delete(i);
    }
    const previous = drawn.get(i);
    if (!previous || keys.some((k) => previous[k] !== box![k])) {
      drawn.set(i, box!);
      p.drawVersions[i] = ++p.drawRevision;
    }
  }
  return drawn;
}
const keys = ['x', 'y', 'width', 'height'] as const;
const states = new WeakMap<
  Player,
  {
    drawn: Map<number, Box>;
    targets: Map<number, Box>;
    flights: Map<number, { from: Box; start: number; duration: number; ease: EaseFn }>;
  }
>();
