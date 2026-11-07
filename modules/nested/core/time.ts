import type { Player } from '../../../packages/core/src/player.ts';
import type { NodeM, InputEvaluator, PlaybackPolicy } from '../../../packages/core/src/load.ts';
import { foldTime, timeFloor, reached } from '../../../packages/core/src/time.ts';
import { crossings } from '../../motion/core/clock.ts';
// The player retains machine state when its animation source clock is scrubbed backwards.
// State ages/fades follow positive source deltas; timeline samples/events follow both directions.
export function clock(
  parent: Player,
  child: Player,
  node: NodeM,
  expression: InputEvaluator | undefined,
  at: string,
) {
  let source = 0,
    before = 0,
    elapsed = 0;
  const state = new WeakMap<object, number>(),
    rates = new WeakMap<object, number>();
  const old = child.playbackPolicy;
  const local = (t: Parameters<PlaybackPolicy['local']>[0], time: number) =>
    t.loop === 'once'
      ? Math.max(0, Math.min(t.duration, time))
      : foldTime(time, t.duration, t.loop === 'pingpong');
  const policy: PlaybackPolicy = {
    get busy() {
      return old?.busy ?? false;
    },
    states: () => old?.states() ?? {},
    inspect: () => old?.inspect() ?? [],
    transition: (t) => old?.transition?.(t) ?? t,
    enter(run, from, to, transition, carry) {
      state.set(run, transition ? source - carry : 0);
      old?.enter(run, from, to, transition, carry);
    },
    prepare(run, s, dt, eligible) {
      rates.set(run, s.speed);
      old?.prepare(run, s, dt, eligible);
    },
    rest: (run, s) => old?.rest(run, s) ?? false,
    local(t, _elapsed, speed, run) {
      const elapsed = source - (state.get(run) ?? 0);
      return old?.local(t, elapsed, speed, run) ?? local(t, elapsed * speed);
    },
    duration: (t, speed, run) => old?.duration(t, speed, run) ?? t.duration / speed,
    finished: (t, _elapsed, run) =>
      old?.finished(t, source - (state.get(run) ?? 0), run) ??
      reached((source - (state.get(run) ?? 0)) * (rates.get(run) ?? 1), t.duration),
    events(t, _a, _b, closed, layer, out, speed, run, markers) {
      const start = state.get(run) ?? 0;
      if (old)
        old.events(t, before - start, source - start, closed, layer, out, speed, run, markers);
      else
        crossings(
          t,
          (before - start) * speed,
          (source - start) * speed,
          closed,
          layer,
          out,
          t.loop,
          markers,
        );
    },
    reduce(t, speed, end, layer, events) {
      if (old) return old.reduce(t, speed, end, layer, events);
      if (end) crossings(t, 0, t.duration, true, layer, events, 'once');
      return end ? t.duration : 0;
    },
    gate: (t, s, e, run) => old?.gate(t, s, e, run) ?? true,
    carry: (t, s, e, run) => old?.carry(t, s, e, run),
    pivot: (p, n) => old?.pivot(p, n) ?? p.model.nodes[n]!.raw.pivot ?? [0, 0],
    compose: (dt, values, events) => old?.compose(dt, values, events) ?? true,
  };
  Object.defineProperty(child, 'playbackPolicy', { value: policy });
  const step = child.step.bind(child);
  child.step = (dt, base) => {
    elapsed += dt;
    const scope = new Map([...parent.model.inputs.keys()].map((n) => [n, parent.get(n)!]));
    const value = expression ? Number(expression(scope)) : elapsed;
    if (!Number.isFinite(value) || value < 0)
      throw Object.assign(new Error('instance time must be finite and nonnegative'), {
        code: 'instance-time',
        pointer: at + '/time',
        hint: 'use a finite nonnegative time in seconds',
      });
    before = source;
    source = node.raw.fps ? timeFloor(value, 1 / node.raw.fps) / node.raw.fps : value;
    return step(Math.max(0, source - before), base);
  };
}
