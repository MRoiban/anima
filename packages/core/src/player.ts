// The player: spec §7 (step), §8 (state machine), §9 (pointer model), §10 (reduced motion).

import { type RGBA, formatHex, lerpColor } from './color.ts';
import { type Mat, IDENTITY, apply, distance, inside, invert, localMatrix, mul } from './geom.ts';
import type { EaseFn } from './ease.ts';
import type {
  InputM,
  LayerM,
  ListenerM,
  Model,
  StateM,
  TimelineM,
  TrackM,
  TransitionM,
  Value,
} from './load.ts';
import { flatten } from './path.ts';
import { text } from './diag.ts';
import { VERBOSE as V } from './flags.ts';

export interface AnimaEvent {
  name: string;
  layer: string | null;
  time: number;
}

export interface StepResult {
  events: AnimaEvent[];
  settled: boolean;
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
  /** Per state, the writes it makes: [slot, constant value or track]. */
  w: Write[][];
  state: number;
  time: number;
  fade: Fade | null;
  /** Reduced motion: the local time the timeline is frozen at, or -1. */
  frozen: number;
}

type Write = [slot: number, value: Value | TrackM];

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
  return typeof a === 'number' ? a + ((b as number) - a) * w : lerpColor(a, b as RGBA, w);
}

const lerp = (a: Value, b: Value, w: number): Value =>
  typeof a === 'number'
    ? a + ((b as number) - a) * w
    : typeof a === 'boolean'
      ? a || (b as boolean)
      : lerpColor(a, b as RGBA, w);

export class Player {
  readonly model: Model;
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
    this.reducedMotion = !!opts.reducedMotion;
    this.addrs = [...model.addrs.keys()];
    const slots = (this.#slots = new Map(this.addrs.map((a, i) => [a, i])));
    this.#rest = this.addrs.map((a) => model.addrs.get(a)!.rest);
    for (const inp of model.inputs.values())
      if (inp.type !== 'trigger') this.#inputVals.set(inp.name, inp.def);
    this.#layers = model.layers.map((m) => ({
      m,
      w: m.states.map((s) =>
        s.pose
          ? [...s.pose].map(([a, v]): Write => [slots.get(a)!, v])
          : s.play !== undefined
            ? model.timelines[s.play]!.tracks.map((t): Write => [slots.get(t.addr)!, t])
            : [],
      ),
      state: m.initial,
      time: 0,
      fade: null,
      frozen: -1,
    }));
    this.#layers.forEach((L) => this.#enter(L, L.state, 0, null, 0, null, this.#entryEvents));
    this.#over = model.listeners.map(() => false);
    this.#vals = this.#rest.slice();
    for (const L of this.#layers) this.#write(L, this.#vals);
  }

  // ------------------------------------------------------------------ host interface

  #input(name: string, types: InputM['type'][]): InputM {
    const inp = this.model.inputs.get(name);
    if (!inp) throw new Error(V ? `anima: no input "${name}"` : 'anima: ' + name);
    if (!types.includes(inp.type))
      throw new Error(V ? `anima: input "${name}" is ${inp.type}` : 'anima: ' + name);
    return inp;
  }

  /** Queue a write to a bool or number input (applied by the next step). */
  set(name: string, value: number | boolean): void {
    const inp = this.#input(name, ['bool', 'number']);
    if (
      typeof value !== (inp.type === 'bool' ? 'boolean' : 'number') ||
      (typeof value === 'number' && !Number.isFinite(value))
    )
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
    return this.#inputVals.get(name);
  }

  get busy(): boolean {
    return this.#queue.length > 0 || !this.#lastSettled;
  }

  /** Current state of each layer. */
  states(): Record<string, string> {
    const o: Record<string, string> = {};
    for (const L of this.#layers) o[L.m.name] = L.m.states[L.state]!.name;
    return o;
  }

  /** Resolved value of an animated address, colours as hex. */
  value(addr: string): number | boolean | string | undefined {
    const s = this.#slots.get(addr);
    if (s === undefined) return undefined;
    const v = this.#vals[s]!;
    return Array.isArray(v) ? formatHex(v) : v;
  }

  /** Every animated address and its resolved value. */
  values(): Record<string, number | boolean | string> {
    const o: Record<string, number | boolean | string> = {};
    for (const a of this.addrs) o[a] = this.value(a)!;
    return o;
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
    const dot = key.indexOf('.');
    return dot < 0 ? n.raw[key] : n.raw[key.slice(0, dot)]?.[key.slice(dot + 1)];
  }

  /** A numeric node property, or `def` when the document leaves it out. */
  num(node: number, key: string, def: number): number {
    const v = this.prop(node, key);
    return typeof v === 'number' ? v : def;
  }

  /** The node's local matrix from its current values (spec §4). */
  local(node: number): Mat {
    const s = this.num(node, 'scale', 1);
    const p = this.model.nodes[node]!.raw.pivot ?? [0, 0];
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
    const ls = this.model.listeners;
    const now = ls.map((l) => kind !== 'leave' && this.hits(l, x, y));
    const run = (on: ListenerM['on'], when: (i: number) => boolean) =>
      ls.forEach((l, i) => {
        if (l.on === on && when(i)) this.#act(l);
      });
    run('leave', (i) => this.#over[i]! && !now[i]);
    run('enter', (i) => !this.#over[i] && now[i]!);
    if (kind === 'move') {
      run('move', (i) => now[i]!);
      if (this.#press)
        this.#pressMoved = Math.max(
          this.#pressMoved,
          Math.hypot(x - this.#pressAt[0], y - this.#pressAt[1]),
        );
    } else if (kind === 'down') {
      run('down', (i) => now[i]!);
      this.#press = now;
      this.#pressAt = [x, y];
      this.#pressMoved = 0;
    } else if (kind === 'up') {
      run('up', (i) => now[i]!);
      const p = this.#press;
      const moved = Math.max(
        this.#pressMoved,
        Math.hypot(x - this.#pressAt[0], y - this.#pressAt[1]),
      );
      if (p && moved < 0.5) run('click', (i) => now[i]! && p[i]!);
      this.#press = null;
    } else this.#press = null;
    this.#over = now;
  }

  #act(l: ListenerM): void {
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
    for (let i = this.model.nodes[l.target]!.parent; i >= 0; i = this.model.nodes[i]!.parent)
      if (this.prop(i, 'visible') === false) return false;
    return test(l.target);
  }

  /** A painted node's outline as polylines in its own coordinates, from current values. */
  #outline(i: number): { pts: number[]; closed: boolean }[] {
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

  step(dt: number): StepResult {
    if (!(dt >= 0)) throw new Error(text('anima: step needs dt ≥ 0'));
    const events = this.#entryEvents;
    this.#entryEvents = [];
    this.time += dt;
    // 1. Inputs
    for (const [op, name, v] of this.#queue) {
      if (op === 'fire') {
        if (!this.#pending.has(name)) this.#pending.set(name, 0);
      } else if (op === 'toggle') this.#inputVals.set(name, !this.#inputVals.get(name));
      else if (op === 'emit') events.push({ name, layer: null, time: 0 });
      else {
        const inp = this.model.inputs.get(name)!;
        this.#inputVals.set(
          name,
          typeof v === 'number' ? Math.min(inp.max, Math.max(inp.min, v)) : v!,
        );
      }
    }
    this.#queue = [];
    // 2. Clocks
    const prev = this.#layers.map((L) => L.time);
    for (const L of this.#layers) {
      L.time += dt;
      if (L.fade && (L.fade.t += dt) >= L.fade.dur) L.fade = null;
    }
    // 3. Layers
    const consumed = new Set<string>();
    const V = this.#rest.slice();
    this.#layers.forEach((L, li) => {
      const st = L.m.states[L.state]!;
      if (st.play !== undefined && L.frozen < 0)
        this.#timelineEvents(L, st, prev[li]! * st.speed, L.time * st.speed, false, events);
      const used = new Set<string>();
      for (let n = 0; ; n++) {
        const cur = L.m.states[L.state]!;
        const tr = L.fade?.lock ? undefined : cur.on.find((t) => this.#holds(t, L, cur, used));
        if (!tr) break;
        if (n === MAX_CHAIN) {
          events.push({ name: '@limit', layer: L.m.name, time: 0 });
          break;
        }
        const tmp = V.slice();
        this.#write(L, tmp);
        const keys = new Set([...(L.fade?.from.keys() ?? []), ...L.w[L.state]!.map((w) => w[0])]);
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
        );
      }
      this.#write(L, V);
    });
    // 4. Clamp, and note what changed
    V.forEach((v, i) => {
      if (typeof v === 'number') {
        const p = this.model.addrs.get(this.addrs[i]!)!.prop;
        V[i] = v = Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, v));
      }
      const o = this.#vals[i]!;
      if (Array.isArray(v) && Array.isArray(o) ? v.some((c, k) => c !== o[k]) : v !== o)
        this.#dirtySet.add(i);
    });
    this.#vals = V;
    // 5. Triggers
    for (const [name, age] of this.#pending) {
      const buf = this.model.inputs.get(name)!.buffer;
      if (consumed.has(name) || !buf || age + dt > buf) this.#pending.delete(name);
      else this.#pending.set(name, age + dt);
    }
    // 6. Settled
    this.#lastSettled = !this.#pending.size && this.#layers.every((L) => this.#atRest(L));
    return { events, settled: this.#lastSettled };
  }

  #atRest(L: LayerRun): boolean {
    if (L.fade) return false;
    const st = L.m.states[L.state]!;
    if (st.play !== undefined && L.frozen < 0) {
      const tl = this.model.timelines[st.play]!;
      if (tl.loop !== 'once' || L.time * st.speed < tl.duration) return false;
    }
    return !st.on.some((t) => t.terms.some((x) => x.k === 'after' && x.s > L.time));
  }

  #finished(L: LayerRun, st: StateM): boolean {
    if (st.play === undefined) return false;
    return L.frozen >= 0 || L.time * st.speed >= this.model.timelines[st.play]!.duration;
  }

  #holds(t: TransitionM, L: LayerRun, st: StateM, used: Set<string>): boolean {
    return t.terms.every((x) => {
      if (x.k === 'end') return this.#finished(L, st);
      if (x.k === 'after') return L.time >= x.s;
      if (x.k === 'cmp') {
        const v = this.#inputVals.get(x.name) as number;
        const c = x.value;
        return x.op === '=='
          ? v === c
          : x.op === '!='
            ? v !== c
            : x.op === '<'
              ? v < c
              : x.op === '<='
                ? v <= c
                : x.op === '>'
                  ? v > c
                  : v >= c;
      }
      if (this.model.inputs.get(x.name)!.type === 'trigger')
        return this.#pending.has(x.name) && !used.has(x.name);
      return !this.#inputVals.get(x.name) === x.not;
    });
  }

  /** Spec §7.3.2(c): overshoot of the time term that made the condition hold. */
  #carry(t: TransitionM, L: LayerRun, st: StateM): number {
    let c = 0;
    for (const x of t.terms) {
      if (x.k === 'after') c = Math.max(c, L.time - x.s);
      if (x.k === 'end')
        c = Math.max(
          c,
          L.frozen >= 0 ? L.time : L.time - this.model.timelines[st.play!]!.duration / st.speed,
        );
    }
    return c;
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
  ): void {
    const st = L.m.states[to]!;
    L.state = to;
    L.time = carry;
    L.frozen = -1;
    if (this.reducedMotion) blend = 0;
    L.fade =
      snap && blend > 0 && carry < blend
        ? { lock, from: snap, dur: blend, ease: ease!, t: carry }
        : null;
    if (st.emit) events.push({ name: st.emit, layer: L.m.name, time: 0 });
    if (st.play === undefined) return;
    const tl = this.model.timelines[st.play]!;
    if (this.reducedMotion && tl.reduced !== 'play') {
      L.frozen = tl.reduced === 'end' ? tl.duration : 0;
      if (tl.reduced === 'end')
        for (const [t, name] of tl.events) events.push({ name, layer: L.m.name, time: t });
    } else this.#timelineEvents(L, st, 0, carry * st.speed, true, events);
  }

  /** Timeline events whose played time lies in (a, b] — or [a, b] when `closed`. */
  #timelineEvents(
    L: LayerRun,
    st: StateM,
    a: number,
    b: number,
    closed: boolean,
    events: AnimaEvent[],
  ): void {
    const tl = this.model.timelines[st.play!]!;
    if (!tl.events.length || b < a) return;
    const d = tl.duration;
    const found: [number, number, string][] = []; // [played time, event time, name]
    const inRange = (t: number) => (closed ? t >= a : t > a) && t <= b;
    tl.events.forEach(([te, name]) => {
      if (tl.loop === 'once') {
        if (inRange(te)) found.push([te, te, name]);
        return;
      }
      const period = tl.loop === 'loop' ? d : 2 * d;
      const k0 = Math.max(0, Math.floor(a / period) - 1);
      const k1 = Math.min(k0 + 10000, Math.floor(b / period) + 1);
      const seen = new Set<number>();
      for (let k = k0; k <= k1; k++) {
        const ts = tl.loop === 'loop' ? [te + k * d] : [te + 2 * k * d, 2 * (k + 1) * d - te];
        for (const t of ts)
          if (inRange(t) && !seen.has(t)) {
            seen.add(t);
            found.push([t, te, name]);
          }
      }
    });
    found.sort((x, y) => x[0] - y[0]);
    for (const [, te, name] of found) events.push({ name, layer: L.m.name, time: te });
  }

  /** The resolve rule (spec §7): write layer L's output over V. */
  #write(L: LayerRun, V: Value[]): void {
    const st = L.m.states[L.state]!;
    const ws = L.w[L.state]!;
    let local = 0;
    if (st.play !== undefined)
      local =
        L.frozen >= 0 ? L.frozen : loopTime(this.model.timelines[st.play]!, L.time * st.speed);
    const sample = (w: Write): Value =>
      Array.isArray(w[1]) || typeof w[1] !== 'object'
        ? (w[1] as Value)
        : sampleTrack(w[1] as TrackM, local);
    const f = L.fade;
    if (!f) {
      for (const w of ws) V[w[0]] = sample(w);
      return;
    }
    const wgt = f.ease(Math.min(1, f.t / f.dur));
    const target = new Map(ws.map((w) => [w[0], sample(w)]));
    for (const k of new Set([...f.from.keys(), ...target.keys()]))
      V[k] = lerp(f.from.get(k) ?? V[k]!, target.get(k) ?? V[k]!, wgt);
  }
}
