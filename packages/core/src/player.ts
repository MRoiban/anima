// The player: spec §7 (step), §8 (state machine), §9 (pointer model), §10 (reduced motion).

import { type RGBA, formatHex, lerpColor } from './color.ts';
import {
  type Mat,
  IDENTITY,
  clamp,
  apply,
  distance,
  inside,
  invert,
  localMatrix,
  mul,
} from './geom.ts';
import type { EaseFn } from './ease.ts';
import type {
  InputM,
  LayerM,
  ListenerM,
  Model,
  PlaybackPolicy,
  StateM,
  TimelineM,
  TrackM,
  TransitionM,
  Value,
} from './load.ts';
import { modules } from './modules.ts';
import { flatten } from './path.ts';
import { text } from './diag.ts';
import { VERBOSE as V } from './flags.ts';

export interface AnimaEvent {
  name: string;
  layer: string | null;
  time: number;
  payload?: Record<string, number | boolean | string>;
  url?: string;
  target?: string;
  audio?: string;
  volume?: number;
}

export interface LayerInspect {
  layer: string;
  state: string;
  prev: string | null;
  blend: number | null;
  locked: boolean;
  timeline: string | null;
  time: number | null;
}

export interface StepResult {
  events: AnimaEvent[];
  settled: boolean;
}

/** Optional nested-player seam; implemented entirely by the components module. */
export interface PlayerExtension {
  input(op: string, name: string, value?: number | boolean): boolean;
  get(name: string): number | boolean | undefined;
  states(): Record<string, string>;
  values(): Record<string, number | boolean | string>;
  inspect(): LayerInspect[];
  pointer(kind: PointerKind, x: number, y: number): void;
  hits(node: number, x: number, y: number): boolean | undefined;
  step(dt: number): StepResult;
}

export type PointerKind = 'move' | 'down' | 'up' | 'leave';

interface Fade {
  /** Started by a non-interruptible transition: no transitions until it ends. */
  lock: boolean;
  from: Map<number, Value>;
  dur: number;
  ease: EaseFn;
  t: number;
}

interface LayerRun {
  m: LayerM;
  /** Per state, slot samplers of local timeline time. */
  w: Map<number, (time: number) => Value>[];
  state: number;
  /** The state before the last transition (for inspectors). */
  prev: number;
  time: number;
  fade: Fade | null;
  /** Reduced motion: the local time the timeline is frozen at, or -1. */
  frozen: number;
}

type Write = [slot: number, sample: (time: number) => Value];

const MAX_CHAIN = 16;

const loopTime = (tl: TimelineM, tau: number): number => {
  const d = tl.duration;
  if (tl.loop === 'once') return Math.min(tau, d);
  if (tl.loop === 'loop') return tau - d * Math.floor(tau / d);
  const q = tau - 2 * d * Math.floor(tau / (2 * d));
  return q <= d ? q : 2 * d - q;
};

/** Spec §5 sampling. */
export function sampleTrack(tr: TrackM, t: number): Value {
  if (tr.sample) return tr.sample(t);
  const ts = tr.times;
  const n = ts.length - 1;
  if (t <= ts[0]!) return tr.values[0]!;
  if (t >= ts[n]!) return tr.values[n]!;
  let i = 0;
  while (ts[i + 1]! <= t) i++;
  const a = tr.values[i]!;
  const b = tr.values[i + 1]!;
  if (typeof a === 'boolean') return a;
  const w = tr.eases[i]!((t - ts[i]!) / (ts[i + 1]! - ts[i]!));
  return mixValues(a, b, w);
}

export const mixValues = (a: Value, b: Value, w: number): Value =>
  typeof a === 'string'
    ? ([...modules.values()].map((m) => m.interpolate?.(a, b, w)).find((v) => v !== undefined) ?? a)
    : typeof a === 'number'
      ? a + ((b as number) - a) * w
      : typeof a === 'boolean'
        ? a || (b as boolean)
        : lerpColor(a, b as RGBA, w);

export class Player {
  readonly model: Model;
  readonly playbackPolicy?: PlaybackPolicy;
  /** Optional module wake callback, installed by a host. */
  onChange?: () => void;
  readonly nested?: PlayerExtension;
  /** Animated addresses, in slot order. */
  readonly addrs: string[];
  readonly #slots: Map<string, number>;
  readonly #rest: Value[];
  #vals: Value[];
  readonly #inputVals = new Map<string, number | boolean>();
  /** Pending triggers and how long they have been pending. */
  readonly #pending = new Map<string, number>();
  #queue: [op: 'set' | 'fire' | 'toggle' | 'emit', name: string, v?: number | boolean][] = [];
  readonly #layers: LayerRun[];
  #entryEvents: AnimaEvent[] = [];
  #lastSettled = false;
  /** Slots whose value changed since `takeDirty()`. */
  readonly #dirtySet = new Set<number>();
  /** Draw consumers track changes independently of takeDirty(). */
  readonly drawVersions: number[];
  drawRevision = 0;
  /** Renderer cache; step output and dirty-slot reads do not depend on it. */
  declare drawData?: import('./draw.ts').DrawFrame;
  /** Reduced motion (spec §10): applies to states entered from now on. */
  reducedMotion = false;
  /** Total step time. */
  time = 0;
  // pointer
  #over: boolean[];
  #press: boolean[] | null = null;
  #pressAt: [number, number] = [0, 0];
  #pressMoved = 0;
  #flat = new Map<number, { pts: number[]; closed: boolean }[]>();

  constructor(model: Model, opts: { reducedMotion?: boolean } = {}) {
    this.model = model;
    this.drawVersions = model.nodes.map(() => 0);
    this.reducedMotion = !!opts.reducedMotion;
    this.addrs = [...model.addrs.keys()];
    const slots = (this.#slots = new Map(this.addrs.map((a, i) => [a, i])));
    this.#rest = this.addrs.map((a) => model.addrs.get(a)!.rest);
    for (const inp of model.inputs.values())
      if (inp.type !== 'trigger') this.#inputVals.set(inp.name, inp.def);
    this.#layers = model.layers.map((m) => ({
      m,
      w: m.states.map(
        (s) =>
          new Map(
            s.pose
              ? [...s.pose].map(([a, v]): Write => [slots.get(a)!, () => v])
              : s.play !== undefined
                ? model.timelines[s.play]!.tracks.map((t): Write => [
                    slots.get(t.addr)!,
                    (time) => sampleTrack(t, time),
                  ])
                : [],
          ),
      ),
      state: m.initial,
      prev: -1,
      time: 0,
      fade: null,
      frozen: -1,
    }));
    this.playbackPolicy = model.playback?.(this);
    this.#layers.forEach((L) => {
      this.#enter(L, L.state, 0, null, 0, null, this.#entryEvents);
      L.prev = -1;
    });
    this.#over = model.listeners.map(() => false);
    this.#vals = this.#rest.slice();
    for (const L of this.#layers) this.#write(L, this.#vals);
    this.nested = model.nesting?.(this);
  }

  // ------------------------------------------------------------------ host interface

  #input(name: string, types: InputM['type'][]): InputM {
    const inp = this.model.inputs.get(name);
    if (!inp || !types.includes(inp.type))
      throw new Error(
        V
          ? inp
            ? `anima: input "${name}" is ${inp.type}`
            : `anima: no input "${name}"`
          : 'anima: ' + name,
      );
    return inp;
  }

  /** Queue a write to a bool or number input (applied by the next step). */
  set(name: string, value: number | boolean): void {
    const inp = this.#input(name, ['bool', 'number']);
    if (inp.type === 'bool' ? typeof value !== 'boolean' : !Number.isFinite(value))
      throw new Error(V ? `anima: input "${name}" takes a ${inp.type}` : 'anima: ' + name);
    this.#queue.push(['set', name, value]);
  }

  fire(name: string): void {
    this.#input(name, ['trigger']);
    this.#queue.push(['fire', name]);
  }

  toggle(name: string): void {
    this.#input(name, ['bool']);
    this.#queue.push(['toggle', name]);
  }

  /** Current value of a bool or number input (before queued writes). */
  get(name: string): number | boolean | undefined {
    return this.nested?.get(name) ?? this.#inputVals.get(name);
  }

  get busy(): boolean {
    return this.#queue.length > 0 || !!this.playbackPolicy?.busy || !this.#lastSettled;
  }

  /** Current state of each layer. */
  states(): Record<string, string> {
    const o: Record<string, string> = {};
    for (const L of this.#layers) o[L.m.name] = L.m.states[L.state]!.name;
    return Object.assign(o, this.nested?.states(), this.playbackPolicy?.states());
  }

  /**
   * Per layer, what an inspector shows: the current and previous state, the blend in progress
   * (0–1, or null when none; `locked` when it is non-interruptible), and the timeline the state
   * plays with its local time.
   */
  inspect(): LayerInspect[] {
    return this.#layers
      .map((L) => {
        const st = L.m.states[L.state]!;
        const tl = st.play === undefined ? undefined : this.model.timelines[st.play]!;
        return {
          layer: L.m.name,
          state: st.name,
          prev: L.prev < 0 ? null : L.m.states[L.prev]!.name,
          blend: L.fade ? Math.min(1, L.fade.t / L.fade.dur) : null,
          locked: !!L.fade?.lock,
          timeline: tl?.name ?? null,
          time: this.#localTime(L),
        };
      })
      .concat(this.nested?.inspect() ?? [], this.playbackPolicy?.inspect() ?? []);
  }

  /** Resolved value of an animated address, colours as hex. */
  value(addr: string): number | boolean | string | undefined {
    const s = this.#slots.get(addr);
    if (s === undefined) return this.nested?.values()[addr];
    const v = this.#vals[s]!;
    return Array.isArray(v) ? formatHex(v) : v;
  }

  /** Every animated address and its resolved value. */
  values(): Record<string, number | boolean | string> {
    const o: Record<string, number | boolean | string> = {};
    for (const a of this.addrs) o[a] = this.value(a)!;
    return Object.assign(o, this.nested?.values());
  }

  /** Addresses contributed by the current layers, including fading-out writes. */
  writes(): string[] {
    const keys = new Set<number>();
    for (const L of this.#layers) {
      for (const k of L.w[L.state]!.keys()) keys.add(k);
      for (const k of L.fade?.from.keys() ?? []) keys.add(k);
    }
    return [
      ...new Set(
        [...keys].map((k) => this.addrs[k]!).concat([...(this.model.bindings?.keys() ?? [])]),
      ),
    ];
  }

  /** Slots changed since the last call. */
  takeDirty(): number[] {
    const d = [...this.#dirtySet];
    this.#dirtySet.clear();
    return d;
  }

  /** A node property's current value (animated or rest), by key (`rotate`, `fill.color`, …). */
  prop(node: number, key: string): Value | string | undefined {
    const n = this.model.nodes[node]!;
    const s = this.#slots.get(n.id + '.' + key);
    if (s !== undefined) return this.#vals[s];
    return key.split('.').reduce((v, k) => v?.[k], n.raw);
  }

  /** A numeric node property, or `def` when the document leaves it out. */
  num(node: number, key: string, def: number): number {
    const v = this.prop(node, key);
    return typeof v === 'number' ? v : def;
  }

  /** The node's local matrix from its current values (spec §4). */
  local(node: number): Mat {
    const s = this.num(node, 'scale', 1);
    const p = this.playbackPolicy?.pivot(this, node) ?? this.model.nodes[node]!.raw.pivot ?? [0, 0];
    return localMatrix(
      this.num(node, 'x', 0),
      this.num(node, 'y', 0),
      p[0],
      p[1],
      this.num(node, 'rotate', 0),
      s * this.num(node, 'scaleX', 1),
      s * this.num(node, 'scaleY', 1),
    );
  }

  world(node: number): Mat {
    let m = IDENTITY;
    for (let i = node; i >= 0; i = this.model.nodes[i]!.parent) m = mul(this.local(i), m);
    return m;
  }

  visible(node: number): boolean {
    for (let i = node; i >= 0; i = this.model.nodes[i]!.parent)
      if (this.prop(i, 'visible') === false) return false;
    return true;
  }

  // ------------------------------------------------------------------ pointer (spec §9)

  /** Report a pointer event in grid units. Listener actions are queued for the next step. */
  pointer(kind: PointerKind, x = 0, y = 0): void {
    this.nested?.pointer(kind, x, y);
    const ls = this.model.listeners;
    const now = ls.map((l) => kind !== 'leave' && this.hits(l, x, y));
    const run = (on: ListenerM['on'], when: (i: number) => boolean) =>
      ls.forEach((l, i) => {
        if (l.on === on && when(i)) this.act(l);
      });
    run('leave', (i) => this.#over[i]! && !now[i]);
    run('enter', (i) => !this.#over[i] && now[i]!);
    run(kind, (i) => now[i]!); // nothing is hit on 'leave'
    // How far the pointer travelled since down: a click needs it to stay within 0.5 units.
    if (kind === 'move' || kind === 'up')
      this.#pressMoved = Math.max(
        this.#pressMoved,
        Math.hypot(x - this.#pressAt[0], y - this.#pressAt[1]),
      );
    const p = this.#press;
    if (kind === 'up' && p && this.#pressMoved < 0.5) run('click', (i) => now[i]! && p[i]!);
    if (kind === 'down') {
      this.#press = now;
      this.#pressAt = [x, y];
      this.#pressMoved = 0;
    } else if (kind !== 'move') this.#press = null;
    this.#over = now;
  }

  /** Queue an already validated listener, including actions routed by an optional module. */
  act(l: ListenerM): void {
    for (const n of l.fire) this.#queue.push(['fire', n]);
    for (const [n, v] of l.set) this.#queue.push(['set', n, v]);
    for (const n of l.toggle) this.#queue.push(['toggle', n]);
    if (l.emit) this.#queue.push(['emit', l.emit]);
  }

  /** Does the listener's target contain the point? */
  hits(l: ListenerM, x: number, y: number): boolean {
    if (l.target < 0) {
      const h = this.model.doc.hit;
      if (h?.circle) return Math.hypot(x - h.circle[0], y - h.circle[1]) <= h.circle[2] + l.pad;
      const [rx, ry, rw, rh] = h?.rect ?? this.model.viewBox;
      return x >= rx - l.pad && y >= ry - l.pad && x <= rx + rw + l.pad && y <= ry + rh + l.pad;
    }
    const test = (i: number): boolean => {
      const n = this.model.nodes[i]!;
      if (this.prop(i, 'visible') === false) return false;
      if (n.type === 'group') return n.children.some(test);
      const nested = this.nested?.hits(i, x, y);
      if (nested !== undefined) return nested;
      const m = this.world(i);
      const inv = invert(m);
      if (!inv) return false;
      const pad = l.pad / Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
      const [lx, ly] = apply(inv, x, y);
      const polys = this.#outline(i);
      const r = n.raw;
      const half = r.stroke ? this.num(i, 'stroke.width', 1) / 2 : 0;
      if (
        r.fill &&
        inside(
          polys.filter((p) => p.closed).map((p) => p.pts),
          lx,
          ly,
          r.fill.rule === 'evenodd',
        )
      )
        return true;
      return (r.stroke || pad > 0) && distance(polys, lx, ly) <= half + pad;
    };
    // the target and its ancestors must be visible
    return this.visible(l.target) && test(l.target);
  }

  /** A painted node's outline as polylines in its own coordinates, from current values. */
  #outline(i: number): { pts: number[]; closed: boolean }[] {
    for (const m of modules.values()) {
      const out = m.outline?.(this, i);
      if (out) return out;
    }
    const n = this.model.nodes[i]!;
    if (n.type === 'path') {
      let f = this.#flat.get(i);
      if (!f) this.#flat.set(i, (f = flatten(n.geom!)));
      return f;
    }
    const r = n.raw;
    if (n.type === 'rect') {
      const [x, y, w, h] = [r.x0, r.y0, this.num(i, 'w', 0), this.num(i, 'h', 0)];
      return [{ pts: [x, y, x + w, y, x + w, y + h, x, y + h], closed: true }];
    }
    const [cx, cy] = r.center;
    const rad = this.num(i, 'r', 0);
    const [a0, a1] =
      n.type === 'circle' ? [0, 360] : [this.num(i, 'from', 0), this.num(i, 'to', 0)];
    const pts: number[] = [];
    const k = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 6));
    for (let j = 0; j <= k; j++) {
      const t = ((a0 + ((a1 - a0) * j) / k) * Math.PI) / 180;
      pts.push(cx + rad * Math.cos(t), cy + rad * Math.sin(t));
    }
    return [{ pts, closed: n.type === 'circle' }];
  }

  // ------------------------------------------------------------------ step (spec §7)

  step(dt: number, base?: (address: string) => Value | undefined): StepResult {
    if (!(dt >= 0)) throw new Error(text('anima: step needs dt ≥ 0'));
    const events = this.#entryEvents;
    this.#entryEvents = [];
    this.time += dt;
    // 1. Inputs
    for (const [op, name, v] of this.#queue) {
      if (this.nested?.input(op, name, v)) continue;
      if (op === 'fire') {
        if (!this.#pending.has(name)) this.#pending.set(name, 0);
      } else if (op === 'toggle') this.#inputVals.set(name, !this.#inputVals.get(name));
      else if (op === 'emit') events.push({ name, layer: null, time: 0 });
      else {
        const inp = this.model.inputs.get(name)!;
        this.#inputVals.set(name, typeof v === 'number' ? clamp(v, inp.min, inp.max) : v!);
      }
    }
    this.#queue = [];
    // 2. Clocks
    const prev = this.#layers.map((L) => L.time);
    for (const L of this.#layers) {
      this.playbackPolicy?.prepare(
        L,
        L.m.states[L.state]!,
        dt,
        (t) => !L.fade?.lock && this.#holds(t, L, L.m.states[L.state]!, new Set(), true),
      );
      L.time += dt;
      if (L.fade && (L.fade.t += dt) >= L.fade.dur) {
        L.fade = null;
        this.model.eventSignal?.(
          events,
          'transition-end',
          L.m.name,
          L.m.states[L.state]!.name,
          this,
        );
      }
    }
    // 3. Layers
    const consumed = new Set<string>();
    const V = base ? this.addrs.map((a, i) => base(a) ?? this.#rest[i]!) : this.#rest.slice();
    this.#layers.forEach((L, li) => {
      const st = L.m.states[L.state]!;
      const used = new Set<string>();
      // Select before reporting crossings so an aligned exit can bound its source interval.
      const first = L.fade?.lock ? undefined : st.on.find((t) => this.#holds(t, L, st, used));
      if (st.play !== undefined && L.frozen < 0)
        this.#timelineEvents(L, st, prev[li]!, L.time, false, events);
      for (let n = 0; ; n++) {
        const cur = L.m.states[L.state]!;
        const tr =
          n === 0
            ? first
            : L.fade?.lock
              ? undefined
              : cur.on.find((t) => this.#holds(t, L, cur, used));
        if (!tr) break;
        if (n === MAX_CHAIN) {
          events.push({ name: '@limit', layer: L.m.name, time: 0 });
          break;
        }
        const tmp = V.slice();
        this.#write(L, tmp);
        const keys = new Set([...(L.fade?.from.keys() ?? []), ...L.w[L.state]!.keys()]);
        const snap = new Map([...keys].map((k) => [k, tmp[k]!]));
        for (const t of tr.triggers) {
          used.add(t);
          consumed.add(t);
        }
        this.#enter(
          L,
          tr.to,
          this.#carry(tr, L, cur),
          snap,
          tr.blend,
          tr.ease,
          events,
          !tr.interruptible,
          tr,
        );
      }
      this.#write(L, V);
    });
    this.model.bindings?.forEach((evaluate, address) => {
      V[this.#slots.get(address)!] = evaluate(this.#inputVals);
    });
    const playbackSettled = this.playbackPolicy?.compose(dt, V, events) ?? true;
    // 4. Clamp, and note what changed
    V.forEach((v, i) => {
      const addr = this.model.addrs.get(this.addrs[i]!)!;
      if (typeof v === 'number') {
        const p = addr.prop;
        V[i] = v = clamp(v, p.min ?? -Infinity, p.max ?? Infinity);
      }
      const o = this.#vals[i]!;
      if (Array.isArray(v) && Array.isArray(o) ? v.some((c, k) => c !== o[k]) : v !== o)
        this.#dirtySet.add(i);
      this.drawVersions[addr.node] = ++this.drawRevision;
    });
    this.#vals = V;
    // 5. Triggers
    for (const [name, age] of this.#pending) {
      const buf = this.model.inputs.get(name)!.buffer;
      if (consumed.has(name) || !buf || age + dt > buf) this.#pending.delete(name);
      else this.#pending.set(name, age + dt);
    }
    this.model.reportEvents?.(this, events);
    const nested = this.nested?.step(dt);
    if (nested) events.push(...nested.events);
    // 6. Settled
    this.#lastSettled =
      playbackSettled &&
      !this.#queue.length &&
      (nested?.settled ?? true) &&
      !this.#pending.size &&
      this.#layers.every((L) => this.#atRest(L));
    return { events, settled: this.#lastSettled };
  }

  #atRest(L: LayerRun): boolean {
    if (L.fade) return false;
    const st = L.m.states[L.state]!;
    if (st.play !== undefined && L.frozen < 0) {
      const tl = this.model.timelines[st.play]!;
      if (
        !this.playbackPolicy?.rest(L, st) &&
        (tl.loop !== 'once' ||
          (this.playbackPolicy
            ? L.time < this.playbackPolicy.duration(tl, st.speed, L)
            : L.time * st.speed < tl.duration))
      )
        return false;
    }
    return !st.on.some((t) => t.terms.some((x) => x.k === 'after' && x.s > L.time));
  }

  #finished(L: LayerRun, st: StateM): boolean {
    if (st.play === undefined) return false;
    return (
      L.frozen >= 0 ||
      (this.playbackPolicy
        ? L.time >= this.playbackPolicy.duration(this.model.timelines[st.play]!, st.speed, L)
        : L.time * st.speed >= this.model.timelines[st.play]!.duration)
    );
  }

  #holds(t: TransitionM, L: LayerRun, st: StateM, used: Set<string>, ungated = false): boolean {
    return (
      t.terms.every((x) => {
        if (x.k === 'end') return this.#finished(L, st);
        if (x.k === 'after') return L.time >= x.s;
        if (x.k === 'cmp') {
          const v = this.get(x.name) as number;
          const c = x.value;
          return {
            '==': v === c,
            '!=': v !== c,
            '<': v < c,
            '<=': v <= c,
            '>': v > c,
            '>=': v >= c,
          }[x.op];
        }
        if (this.model.inputs.get(x.name)!.type === 'trigger')
          return this.#pending.has(x.name) && !used.has(x.name);
        return !this.get(x.name) === x.not;
      }) &&
      (ungated || (this.playbackPolicy?.gate(t, st, L.time, L) ?? true))
    );
  }

  /** Spec §7.3.2(c): overshoot of the time term that made the condition hold. */
  #carry(t: TransitionM, L: LayerRun, st: StateM): number {
    let c = 0;
    for (const x of t.terms) {
      if (x.k === 'after') c = Math.max(c, L.time - x.s);
      if (x.k === 'end')
        c = Math.max(
          c,
          L.frozen >= 0
            ? L.time
            : L.time -
                (this.playbackPolicy?.duration(this.model.timelines[st.play!]!, st.speed, L) ??
                  this.model.timelines[st.play!]!.duration / st.speed),
        );
    }
    const extra = this.playbackPolicy?.carry(t, st, L.time, L);
    return extra === undefined
      ? c
      : t.terms.some((x) => x.k === 'after' || x.k === 'end')
        ? Math.min(c, extra)
        : extra;
  }

  #enter(
    L: LayerRun,
    to: number,
    carry: number,
    snap: Map<number, Value> | null,
    blend: number,
    ease: EaseFn | null,
    events: AnimaEvent[],
    lock = false,
    transition?: TransitionM,
  ): void {
    const st = L.m.states[to]!;
    if (transition) {
      this.model.eventSignal?.(
        events,
        'state-end',
        L.m.name,
        L.m.states[L.state]!.name,
        this,
        transition,
      );
      this.model.eventSignal?.(events, 'transition-start', L.m.name, st.name, this, transition);
    }
    this.playbackPolicy?.enter(
      L,
      transition ? L.m.states[L.state] : undefined,
      st,
      transition,
      carry,
    );
    L.prev = L.state;
    L.state = to;
    L.time = carry;
    L.frozen = -1;
    if (this.reducedMotion) blend = 0;
    L.fade =
      snap && blend > 0 && carry < blend
        ? { lock, from: snap, dur: blend, ease: ease!, t: carry }
        : null;
    if (transition && !L.fade)
      this.model.eventSignal?.(events, 'transition-end', L.m.name, st.name, this, transition);
    if (st.emit) events.push({ name: st.emit, layer: L.m.name, time: 0 });
    if (st.play === undefined) return;
    const tl = this.model.timelines[st.play]!;
    if (this.reducedMotion && tl.reduced !== 'play') {
      if (this.playbackPolicy)
        L.frozen = this.playbackPolicy.reduce(tl, st.speed, tl.reduced === 'end', L.m.name, events);
      else {
        L.frozen = tl.reduced === 'end' ? tl.duration : 0;
        if (tl.reduced === 'end')
          for (const [t, name] of tl.events) events.push({ name, layer: L.m.name, time: t });
      }
    } else this.#timelineEvents(L, st, 0, carry, true, events);
  }

  /** Timeline events whose played time lies in (a, b] — or [a, b] when `closed`. */
  #timelineEvents(
    L: LayerRun,
    st: StateM,
    a: number,
    b: number,
    closed: boolean,
    events: AnimaEvent[],
    source?: [number, string][],
  ): void {
    const tl = this.model.timelines[st.play!]!;
    if (!source) {
      const markers = this.model.timelineMarkers?.(tl);
      if (markers) this.#timelineEvents(L, st, a, b, false, events, markers);
    }
    source ??= tl.events;
    if (this.playbackPolicy)
      return this.playbackPolicy.events(tl, a, b, closed, L.m.name, events, st.speed, L, source);
    a *= st.speed;
    b *= st.speed;
    if (!source.length || b < a) return;
    const d = tl.duration;
    const found: [number, number, string][] = []; // [played time, event time, name]
    const inRange = (t: number) => (closed ? t >= a : t > a) && t <= b;
    const once = tl.loop === 'once';
    const loop = tl.loop === 'loop';
    const period = loop ? d : 2 * d;
    source.forEach(([te, name]) => {
      // Repeats k0..k1 of the period (a 'once' timeline has just k = 0); pingpong plays each
      // event twice per period, forwards and back.
      const k0 = once ? 0 : Math.max(0, Math.floor(a / period) - 1);
      const k1 = once ? 0 : Math.min(k0 + 10000, Math.floor(b / period) + 1);
      const seen = new Set<number>();
      for (let k = k0; k <= k1; k++)
        for (const t of loop || once ? [te + k * d] : [te + 2 * k * d, 2 * (k + 1) * d - te])
          if (inRange(t) && !seen.has(t)) {
            seen.add(t);
            found.push([t, te, name]);
          }
    });
    found.sort((x, y) => x[0] - y[0]);
    for (const [, te, name] of found) events.push({ name, layer: L.m.name, time: te });
  }

  #localTime(L: LayerRun): number | null {
    const st = L.m.states[L.state]!;
    if (st.play === undefined) return null;
    return L.frozen >= 0
      ? L.frozen
      : (this.playbackPolicy?.local(this.model.timelines[st.play]!, L.time, st.speed, L) ??
          loopTime(this.model.timelines[st.play]!, L.time * st.speed));
  }

  /** The resolve rule (spec §7): write layer L's output over V. */
  #write(L: LayerRun, V: Value[]): void {
    const ws = L.w[L.state]!;
    const local = this.#localTime(L) ?? 0;
    const f = L.fade;
    if (!f) {
      for (const [k, sample] of ws) V[k] = sample(local);
      return;
    }
    const wgt = f.ease(Math.min(1, f.t / f.dur));
    const target = new Map([...ws].map(([k, sample]) => [k, sample(local)]));
    for (const k of new Set([...f.from.keys(), ...target.keys()]))
      V[k] = this.model.addrs.get(this.addrs[k]!)!.prop.discrete
        ? (target.get(k) ?? V[k]!)
        : mixValues(f.from.get(k) ?? V[k]!, target.get(k) ?? V[k]!, wgt);
  }
}
