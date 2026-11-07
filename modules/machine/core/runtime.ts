import { reached, snapTime, foldTime } from '../../../packages/core/src/time.ts';
// Extends the existing player through its playback-policy seam; no second state-machine engine.
import type { Player, AnimaEvent } from '../../../packages/core/src/player.ts';
import { sampleTrack, mixValues } from '../../../packages/core/src/player.ts';
import type {
  PlaybackPolicy,
  StateM,
  TimelineM,
  TransitionM,
  Value,
} from '../../../packages/core/src/load.ts';
import {
  states,
  transitions,
  compiledActions,
  type Run,
  type Operand,
  type Actions,
} from './types.ts';
let sample = sampleTrack,
  mix = mixValues;
export function install(s: typeof sampleTrack, m: typeof mixValues): void {
  sample = s;
  mix = m;
}
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const local = (t: TimelineM, time: number) =>
  t.loop === 'once'
    ? Math.min(t.duration, snapTime(time, t.duration))
    : foldTime(time, t.duration, t.loop === 'pingpong');
const compare = (
  a: import('../../../packages/core/src/load.ts').Value,
  b: import('../../../packages/core/src/load.ts').Value,
  op: string,
): boolean => {
  if (op === '==') return a === b;
  if (op === '!=') return a !== b;
  if (op === '<') return a < b;
  if (op === '<=') return a <= b;
  if (op === '>') return a > b;
  return a >= b;
};
interface Data {
  eligible: (t: TransitionM) => boolean;
  chosen?: TransitionM | null;
  consumed: Set<string>;
  changed: Set<TransitionM>;
  outgoing?: {
    writes: Map<number, (t: number) => Value>;
    state: StateM;
    time: number;
    frozen: number;
    reduced?: boolean;
  };
  reduced?: boolean;
  pending?: { transition: TransitionM; duration: number; elapsed: number };
}
export class MachinePolicy implements PlaybackPolicy {
  readonly p: Player;
  readonly base?: PlaybackPolicy;
  readonly runs = new Map<Run, Data>();
  readonly originalStates = new WeakMap<StateM, StateM>();
  readonly originalTransitions = new WeakMap<TransitionM, TransitionM>();
  readonly previous = new Map<string, import('../../../packages/core/src/load.ts').Value>();
  readonly slots: Map<string, number>;
  #seed: number;

  constructor(p: Player, base?: PlaybackPolicy) {
    this.p = p;
    this.base = base;
    this.slots = new Map(p.addrs.map((a, i) => [a, i]));
    this.#seed = p.model.doc.machineSeed ?? 0x6d2b79f5;
    for (const [n, i] of p.model.inputs) if (i.type !== 'trigger') this.previous.set(n, i.def);
  }
  random(): number {
    this.#seed = (Math.imul(this.#seed, 1664525) + 1013904223) >>> 0;
    return this.#seed / 4294967296;
  }
  get busy(): boolean {
    return !!this.base?.busy;
  }
  states = () => this.base?.states() ?? {};
  inspect = () => this.base?.inspect() ?? [];
  pivot = (p: Player, n: number): [number, number] =>
    this.base?.pivot(p, n) ?? p.model.nodes[n]!.raw.pivot ?? [0, 0];
  original(s: StateM): StateM {
    return this.originalStates.get(s) ?? s;
  }
  transition(t: TransitionM): TransitionM {
    return this.originalTransitions.get(t) ?? t;
  }
  operand(o: Operand): import('../../../packages/core/src/load.ts').Value {
    if (typeof o !== 'object') return o;
    if (o.focus !== undefined) return this.p.machineFocus?.(o.focus) ?? false;
    if (o.component !== undefined) return this.p.get(o.component)!;
    const [, , w, h] = this.p.model.viewBox;
    return o.artboard === 'width' ? w : o.artboard === 'height' ? h : w / h;
  }
  allowed(t: TransitionM, r: Run): boolean {
    const o = transitions.get(t),
      d = this.runs.get(r)!;
    if (o?.disabled) return false;
    if (o?.change) {
      const a = this.previous.get(o.change.input)!,
        b = this.p.get(o.change.input)!;
      if (
        d.changed.has(this.transition(t)) ||
        !(o.change.mode === 'changed' ? a !== b : o.change.mode === 'increased' ? b > a : b < a)
      )
        return false;
    }
    return (
      !o?.guard || compare(this.operand(o.guard.left), this.operand(o.guard.right), o.guard.op)
    );
  }
  enter(
    run: object,
    from: StateM | undefined,
    to: StateM,
    t: TransitionM | undefined,
    carry: number,
  ): void {
    const r = run as Run;
    let d = this.runs.get(r);
    if (!d) {
      // The model is reusable. Mutable transition durations and weighted choices belong to a player.
      const cloned = r.m.states.map((s) => {
        const c = {
          ...s,
          on: s.on
            .filter((tr) => !transitions.get(tr)?.disabled)
            .map((tr) => {
              const ct = { ...tr };
              transitions.set(ct, transitions.get(tr)!);
              this.originalTransitions.set(ct, tr);
              return ct;
            }),
        };
        states.set(c, states.get(s)!);
        this.originalStates.set(c, s);
        return c;
      });
      r.m = { ...r.m, states: cloned };
      d = { eligible: () => false, consumed: new Set(), changed: new Set() };
      this.runs.set(r, d);
      to = cloned[r.state]!;
    }
    const options = t && transitions.get(t);
    if (from) {
      if (options?.continue && !reached(carry, t!.blend) && !this.p.reducedMotion)
        d.outgoing = {
          writes: r.w[r.state]!,
          state: from,
          time: r.time,
          frozen: r.frozen,
          reduced: d.reduced,
        };
      else d.outgoing = undefined;
      this.act(states.get(from)?.exitActions);
    }
    d.reduced = this.p.reducedMotion;
    // Interrupted transitions do not run end actions.
    d.pending = undefined;
    this.act(options?.actions);
    this.act(states.get(to)?.enterActions);
    if (options?.change) d.changed.add(this.transition(t!));
    for (const n of t?.triggers ?? []) d.consumed.add(n);
    d.chosen = undefined;
    if (states.get(to)?.kind === 'exit' && from) {
      const at =
        r.frozen >= 0
          ? r.frozen
          : from.play === undefined
            ? 0
            : this.local(this.p.model.timelines[from.play]!, r.time, from.speed, run);
      r.w[r.m.states.indexOf(to)] = new Map(
        [...r.w[r.state]!].map(([k, sampler]) => {
          const value = states.get(from)?.children
            ? this.blended(r, from, this.p.addrs[k]!)
            : sampler(at);
          return [k, () => value];
        }),
      );
    }
    this.base?.enter(
      run,
      from && this.original(from),
      this.original(to),
      t && this.transition(t),
      carry,
    );
    const info = states.get(to);
    if (info?.children) {
      const keys = new Set(
        info.children.flatMap((c) => this.p.model.timelines[c.timeline]!.tracks.map((t) => t.addr)),
      );
      r.w[r.m.states.indexOf(to)] = new Map(
        [...keys].map((addr) => [this.slots.get(addr)!, () => this.blended(r, to, addr)]),
      );
    }
    if (options?.endActions) {
      if (this.p.reducedMotion || reached(carry, t!.blend)) this.act(options.endActions);
      else d.pending = { transition: t!, duration: t!.blend, elapsed: carry };
    }
  }
  act(a?: Actions): void {
    if (!a) return;
    this.p.act({ on: '', target: -1, pad: 0, ...compiledActions.get(a)! });
  }

  prepare(run: object, s: StateM, dt: number, eligible: (t: TransitionM) => boolean): void {
    const r = run as Run,
      d = this.runs.get(r)!;
    d.eligible = eligible;
    d.chosen = undefined;
    d.consumed.clear();
    d.changed.clear();
    this.base?.prepare(
      run,
      this.original(s),
      dt,
      (t) => !transitions.get(t)?.disabled && eligible(t),
    );
    if (
      d.pending &&
      (this.p.reducedMotion || reached((d.pending.elapsed += dt), d.pending.duration))
    ) {
      this.act(transitions.get(d.pending.transition)?.endActions);
      d.pending = undefined;
    }
    if (d.outgoing && r.fade) {
      d.outgoing.time += dt;
      const out = d.outgoing,
        st = out.state;
      const time =
        out.frozen >= 0
          ? out.frozen
          : st.play === undefined
            ? 0
            : this.childClock(this.p.model.timelines[st.play]!, out.time, st.speed);
      for (const [k, sampler] of out.writes)
        r.fade.from.set(
          k,
          states.get(st)?.children
            ? this.blended(r, st, this.p.addrs[k]!, out.time, out.frozen, out.reduced)
            : sampler(time),
        );
    } else d.outgoing = undefined;
  }
  duration(t: TimelineM, speed: number, run: object): number {
    return this.base?.duration(t, speed, run) ?? t.duration / speed;
  }
  finished(t: TimelineM, elapsed: number, run: object): boolean {
    const r = run as Run;
    return (
      this.base?.finished(t, elapsed, run) ??
      reached(elapsed * r.m.states[r.state]!.speed, t.duration)
    );
  }
  local(t: TimelineM, time: number, speed: number, run: object): number {
    return this.base?.local(t, time, speed, run) ?? local(t, time * speed);
  }
  rest(run: object, s: StateM): boolean {
    return this.base?.rest(run, this.original(s)) ?? false;
  }
  gate(t: TransitionM, s: StateM, elapsed: number, run: object): boolean {
    const r = run as Run,
      d = this.runs.get(r)!,
      o = transitions.get(t);
    const eligible = (tr: TransitionM) =>
      this.allowed(tr, r) &&
      (this.base?.gate(this.transition(tr), this.original(s), elapsed, run) ?? true) &&
      (transitions.get(tr)?.exitRatio === undefined ||
        reached(
          elapsed,
          transitions.get(tr)!.exitRatio === 0
            ? 0
            : this.duration(this.p.model.timelines[s.play!]!, s.speed, run) *
                transitions.get(tr)!.exitRatio!,
        ));
    if (!eligible(t)) return false;
    if (states.get(s)?.kind === 'random') {
      if (d.chosen === undefined) {
        const choices = s.on.filter(
          (tr) =>
            !tr.triggers.some((n) => d.consumed.has(n)) &&
            d.eligible(tr) &&
            eligible(tr) &&
            (transitions.get(tr)?.weight ?? 1) > 0,
        );
        let n =
          (choices.length ? this.random() : 0) *
          choices.reduce((a, tr) => a + (transitions.get(tr)?.weight ?? 1), 0);
        d.chosen = choices.find((tr) => (n -= transitions.get(tr)?.weight ?? 1) < 0) ?? null;
      }
      if (d.chosen !== t) return false;
    }
    if (o?.blendRatio !== undefined)
      t.blend =
        o.blendRatio === 0
          ? 0
          : this.duration(this.p.model.timelines[s.play!]!, s.speed, run) * o.blendRatio;
    return true;
  }
  carry(t: TransitionM, s: StateM, elapsed: number, run: object): number | undefined {
    // A change is observed now, not at an earlier time threshold in the source.
    if (transitions.get(this.transition(t))?.change) return 0;
    const ratio = transitions.get(t)?.exitRatio;
    if (ratio !== undefined)
      return Math.max(
        0,
        elapsed -
          (ratio === 0 ? 0 : ratio * this.duration(this.p.model.timelines[s.play!]!, s.speed, run)),
      );
    return this.base?.carry(this.transition(t), this.original(s), elapsed, run);
  }
  resume(run: object, time: number): void {
    if (this.base) this.base.resume(run, time);
    else {
      const r = run as Run;
      r.time = time / r.m.states[r.state]!.speed;
    }
  }
  reduce(t: TimelineM, speed: number, end: boolean, layer: string, out: AnimaEvent[]): number {
    if (this.base) return this.base.reduce(t, speed, end, layer, out);
    if (end) for (const [time, name] of t.events) out.push({ name, layer, time });
    return end ? t.duration : 0;
  }
  events(
    t: TimelineM,
    a: number,
    b: number,
    closed: boolean,
    layer: string,
    out: AnimaEvent[],
    speed: number,
    run: object,
    source = t.events,
  ): void {
    if (this.base) return this.base.events(t, a, b, closed, layer, out, speed, run, source);
    a *= speed;
    b *= speed;
    const found: [number, number, string][] = [],
      d = t.duration;
    for (const [time, name] of source) {
      const k0 =
        t.loop === 'once' ? 0 : Math.max(0, Math.floor(a / (t.loop === 'loop' ? d : 2 * d)) - 1);
      const k1 =
        t.loop === 'once'
          ? 0
          : Math.min(k0 + 10000, Math.floor(b / (t.loop === 'loop' ? d : 2 * d)) + 1);
      const seen = new Set<number>();
      for (let k = k0; k <= k1; k++)
        for (const at of t.loop === 'pingpong' && time !== 0 && time !== d
          ? [time + 2 * k * d, 2 * (k + 1) * d - time]
          : [time + k * (t.loop === 'pingpong' ? 2 * d : d)])
          if (!seen.has(at) && (closed ? reached(at, a) : !reached(a, at)) && reached(b, at)) {
            seen.add(at);
            found.push([at, time, name]);
          }
    }
    found.sort((a, b) => a[0] - b[0]);
    for (const [, time, name] of found) out.push({ name, layer, time });
  }
  childClock(t: TimelineM, elapsed: number, speed: number, reduced = false): number {
    const raw = this.p.model.doc.requires?.includes('motion')
      ? this.p.model.doc.timelines[t.name]
      : {};
    const [start, end] = raw.work ?? [0, t.duration],
      span = end - start,
      rate = speed * (raw.speed ?? 1);
    if (reduced && t.reduced !== 'play')
      return t.reduced === 'skip' ? (rate < 0 ? end : start) : rate < 0 ? start : end;
    let x = (rate < 0 ? span : 0) + elapsed * rate;
    if (t.loop === 'once') x = Math.max(0, Math.min(span, snapTime(snapTime(x, 0), span)));
    else x = foldTime(x, span, t.loop === 'pingpong');
    const at = start + x;
    const q = raw.quantize;
    if (!q || at === end) return at;
    const tick = Math.round(at * q) / q;
    return Math.max(start, snapTime(at, tick) === tick ? tick : Math.floor(at * q) / q);
  }

  blended(
    r: Run,
    state: StateM,
    address: string,
    elapsed = r.time,
    frozen = r.frozen,
    reduced = this.runs.get(r)?.reduced,
  ): Value {
    const info = states.get(state)!,
      children = info.children!;
    const rest = this.p.model.addrs.get(address)!.rest;
    let weights: number[];
    if (info.mix!.mode === '1d') {
      const x = info.axis!(this.p);
      let hi = children.findIndex((c) => c.at >= x);
      if (hi < 0) hi = children.length - 1;
      const lo = Math.max(0, hi - 1),
        u = hi === lo ? 1 : clamp((x - children[lo]!.at) / (children[hi]!.at - children[lo]!.at));
      weights = children.map((_, i) => (i === hi ? u : i === lo ? 1 - u : 0));
    } else weights = children.map((c) => clamp(c.weight(this.p)));
    const values = children.map((c) => {
      const t = this.p.model.timelines[c.timeline]!,
        track = t.tracks.find((tr) => tr.addr === address);
      const time = this.childClock(t, elapsed, state.speed, reduced || frozen >= 0);
      return track ? sample(track, time) : rest;
    });
    if (info.mix!.mode !== '1d') {
      let v = info.mix!.mode === 'additive' ? values[0]! : rest;
      for (let i = info.mix!.mode === 'additive' ? 1 : 0; i < values.length; i++)
        if (weights[i]) v = mix(v, values[i]!, weights[i]!);
      return v;
    }
    let v = rest,
      total = 0;
    for (let i = 0; i < values.length; i++)
      if (weights[i]) {
        const next = total + weights[i]!;
        v = total === 0 ? values[i]! : mix(v, values[i]!, weights[i]! / next);
        total = next;
      }
    return total < 1 ? mix(rest, v, total) : v;
  }
  compose(dt: number, values: Value[], events: AnimaEvent[]): boolean {
    const settled = this.base?.compose(dt, values, events) ?? true;
    for (const n of this.previous.keys()) this.previous.set(n, this.p.get(n)!);
    return (
      settled &&
      [...this.runs].every(([r]) => {
        const s = r.m.states[r.state]!,
          info = states.get(s);
        return (
          !info?.children ||
          info.children.every((c) => {
            const t = this.p.model.timelines[c.timeline]!;
            const raw = this.p.model.doc.requires?.includes('motion')
              ? this.p.model.doc.timelines[t.name]
              : {};
            const [a, b] = raw.work ?? [0, t.duration],
              rate = s.speed * (raw.speed ?? 1);
            return (
              (this.runs.get(r)?.reduced && t.reduced !== 'play') ||
              rate === 0 ||
              (t.loop === 'once' && reached(r.time * Math.abs(rate), b - a))
            );
          })
        );
      })
    );
  }
}
