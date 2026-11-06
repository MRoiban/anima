// Declarative controls own per-layer clocks; the base player still owns state time and fades.
import type { StateM, TransitionM, TimelineM } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { bounds, clock, position, timing } from './clock.ts';
import { reached, snapTime, timeFloor } from '../../../packages/core/src/time.ts';
export const stateControls = new WeakMap<StateM, { hold?: boolean }>();
export const syncs = new WeakSet<TransitionM>();
export const nextExits = new WeakMap<TransitionM, 'step' | 'loop'>();
interface Run {
  time: number;
  frozen: number;
}
interface Clock {
  start: number;
  state: StateM;
  limit: number;
  armed: Map<TransitionM, number>;
  value?: number;
  synced: boolean;
}
export class StateClocks {
  #runs = new WeakMap<object, Clock>();
  readonly player: Player;
  constructor(player: Player) {
    this.player = player;
  }
  rate(s: StateM): number {
    return s.speed * (timing.get(this.player.model.timelines[s.play!]!)?.speed ?? 1);
  }
  controlled(s: StateM): boolean {
    return !!stateControls.get(s)?.hold || !!this.player.model.timeBindings?.has(s);
  }
  synced(run: object): boolean {
    return this.#runs.get(run)!.synced;
  }
  isControlled(run: object): boolean {
    return this.controlled(this.#runs.get(run)!.state);
  }
  input(s: StateM): number | undefined {
    const expression = this.player.model.timeBindings?.get(s);
    if (!expression) return;
    const inputs = new Map(
      [...this.player.model.inputs.keys()].map((n) => [n, this.player.get(n)!]),
    );
    const [a, b] = bounds(this.player.model.timelines[s.play!]!);
    return Math.max(a, Math.min(b, expression(inputs)));
  }
  raw(run: object, elapsed: number): number {
    const c = this.#runs.get(run)!;
    // A reached gate also bounds the source sample and event interval.
    if (Number.isFinite(c.limit) && reached(elapsed, c.limit)) elapsed = c.limit;
    return (
      c.start + (this.controlled(c.state) ? 0 : Math.min(elapsed, c.limit) * this.rate(c.state))
    );
  }
  enter(
    run: object,
    from: StateM | undefined,
    to: StateM,
    tr: TransitionM | undefined,
    carry: number,
  ): void {
    if (to.play === undefined) {
      this.#runs.delete(run);
      return;
    }
    const t = this.player.model.timelines[to.play]!;
    const old = run as Run;
    const value = this.input(to);
    const start =
      tr && syncs.has(tr) && from?.play !== undefined
        ? old.frozen >= 0
          ? old.frozen
          : position(t, this.raw(run, old.time - carry), t.loop, false)
        : (value ?? clock(t, 0, to.speed));
    this.#runs.set(run, {
      start,
      state: to,
      limit: Infinity,
      armed: new Map(),
      value,
      synced: !!tr && syncs.has(tr),
    });
  }
  // Inclusive boundary: a request observed exactly at a tick need not wait another tick.
  arm(run: object, s: StateM, tr: TransitionM): number {
    const c = this.#runs.get(run)!;
    let at = c.armed.get(tr);
    if (at !== undefined) return at;
    const r = run as Run,
      t = this.player.model.timelines[s.play!]!;
    const [a, b] = bounds(t),
      rate = this.rate(s);
    if (r.frozen >= 0 || this.controlled(s) || !rate) at = r.time;
    else {
      const raw = this.raw(run, r.time),
        local = position(t, raw, t.loop, false);
      const segment = timeFloor(raw - a, b - a);
      const forward = rate > 0 !== (t.loop === 'pingpong' && Math.abs(segment % 2) === 1);
      const q = nextExits.get(tr) === 'step' ? timing.get(t)?.quantize : undefined;
      const rounded = q ? Math.round(local * q) / q : forward ? a : b;
      const exact =
        snapTime(local, rounded) === rounded ||
        snapTime(local, a) === a ||
        snapTime(local, b) === b;
      const boundary = exact
        ? local
        : q
          ? Math.max(a, Math.min(b, (forward ? Math.ceil(local * q) : Math.floor(local * q)) / q))
          : forward
            ? b
            : a;
      at = r.time + Math.abs(boundary - local) / Math.abs(rate);
    }
    c.armed.set(tr, at);
    return at;
  }
  prepare(run: object, s: StateM, _dt: number, eligible: (t: TransitionM) => boolean): void {
    if (s.play === undefined) return;
    const c = this.#runs.get(run)!;
    const value = this.input(s);
    if (value !== undefined && value !== c.value) {
      c.start = value;
      c.value = value;
    }
    c.limit = Infinity;
    for (const tr of s.on) {
      if (!nextExits.has(tr)) continue;
      if (!eligible(tr)) {
        c.armed.delete(tr);
        continue;
      }
      this.arm(run, s, tr);
    }
  }
  gate(run: object, s: StateM, tr: TransitionM, elapsed: number): boolean {
    if (!nextExits.has(tr)) return true;
    const at = this.arm(run, s, tr);
    if (!reached(elapsed, at)) return false;
    // The first eligible transition in declaration order owns the source event/sample cutoff.
    this.#runs.get(run)!.limit = at;
    return true;
  }
  carry(run: object, s: StateM, tr: TransitionM, elapsed: number): number | undefined {
    return nextExits.has(tr) ? Math.max(0, elapsed - this.arm(run, s, tr)) : undefined;
  }
  finished(t: TimelineM, elapsed: number, run: object): boolean {
    const c = this.#runs.get(run)!;
    if (this.controlled(c.state)) return false;
    const rate = this.rate(c.state),
      [a, b] = bounds(t);
    const raw = this.raw(run, elapsed);
    return rate < 0 ? reached(a, raw) : rate > 0 && reached(raw, b);
  }
  duration(t: TimelineM, speed: number, run: object): number {
    const c = this.#runs.get(run)!;
    if (this.controlled(c.state)) return Infinity;
    const [a, b] = bounds(t),
      rate = speed * (timing.get(t)?.speed ?? 1);
    return rate ? Math.max(0, (rate < 0 ? c.start - a : b - c.start) / Math.abs(rate)) : Infinity;
  }
}
