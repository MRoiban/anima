import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import {
  occurrence,
  capturing,
  stampEntryEvent,
  type CapturedEvent,
} from '../../../packages/core/src/event-capture.ts';
import { resolveAddress } from '../../../packages/core/src/load.ts';
import type {
  Model,
  Value,
  TimelineM,
  PlaybackPolicy,
  StateM,
  TransitionM,
} from '../../../packages/core/src/load.ts';
import type { Player, AnimaEvent } from '../../../packages/core/src/player.ts';
import { sampleTrack, mixValues } from '../../../packages/core/src/player.ts';
import type { NodeType } from '../../../packages/core/src/registry.ts';
import { StateClocks } from './control.ts';
import { reached, timeFloor } from '../../../packages/core/src/time.ts';
import { bounds, crossings, position, timing, type Loop } from './clock.ts';

export interface AnimationInfo {
  name: string;
  duration: number;
  speed: number;
  quantize: number | null;
  work: [number, number];
  loop: Loop;
}
export interface TimelineOptions {
  name?: string;
  mix?: number;
  speed?: number;
  loop?: Loop;
}
const finite = (x: number) => {
  if (!Number.isFinite(x)) throw Error('anima: expected a finite number');
  return x;
};
let sample = sampleTrack,
  blend = mixValues,
  resolve = resolveAddress;
const mixValue = (a: Value, b: Value, w: number, discrete: boolean): Value =>
  discrete ? b : blend(a, b, w);
export function metadata(t: TimelineM): AnimationInfo {
  return {
    name: t.name,
    duration: t.duration,
    speed: timing.get(t)?.speed ?? 1,
    quantize: timing.get(t)?.quantize ?? null,
    work: [...bounds(t)],
    loop: t.loop,
  };
}
export class TimelineInstance {
  readonly animation: TimelineM;
  readonly name: string;
  #owner: MotionRuntime;
  #mix = 1;
  #speed: number;
  #loop: Loop;
  #clock: number;
  #active = true;
  #playing = true;
  #entered = true;
  #frozen = false;
  didLoop = false;
  constructor(owner: MotionRuntime, t: TimelineM, options: TimelineOptions = {}) {
    this.#owner = owner;
    this.animation = t;
    this.name = options.name ?? t.name;
    if (!/^[a-z][a-zA-Z0-9-]*$/.test(this.name)) throw Error('anima: invalid instance name');
    this.#speed = finite(options.speed ?? timing.get(t)?.speed ?? 1);
    this.#loop = options.loop ?? t.loop;
    this.#clock = bounds(t)[this.#speed < 0 ? 1 : 0];
    this.mix = options.mix ?? 1;
    this.loop = this.#loop;
  }
  get info(): AnimationInfo {
    return metadata(this.animation);
  }
  get time(): number {
    return position(this.animation, this.#clock, this.#loop, false);
  }
  set time(value: number) {
    this.seek(value);
  }
  get playing(): boolean {
    return this.#active && this.#playing && !this.finished;
  }
  get finished(): boolean {
    const [a, b] = bounds(this.animation);
    return (
      this.#loop === 'once' && (this.#speed < 0 ? reached(a, this.#clock) : reached(this.#clock, b))
    );
  }
  get mix(): number {
    return this.#mix;
  }
  set mix(value: number) {
    this.#mix = Math.max(0, Math.min(1, finite(value)));
    this.#owner.wake();
  }
  get speed(): number {
    return this.#speed;
  }
  set speed(value: number) {
    this.#speed = finite(value);
    this.#owner.wake();
  }
  get loop(): Loop {
    return this.#loop;
  }
  set loop(value: Loop | null) {
    if (value !== null && !['once', 'loop', 'pingpong'].includes(value))
      throw Error('anima: invalid loop');
    this.#loop = value ?? this.animation.loop;
    this.#owner.wake();
  }
  seek(seconds: number): this {
    const [a, b] = bounds(this.animation);
    this.#clock = Math.max(a, Math.min(b, finite(seconds)));
    this.#frozen = false;
    this.#entered = false;
    this.didLoop = false;
    this.#active = true;
    this.#owner.wake();
    return this;
  }
  scrub(progress: number): this {
    const [a, b] = bounds(this.animation);
    this.pause();
    return this.seek(a + (b - a) * Math.max(0, Math.min(1, finite(progress))));
  }
  play(): this {
    this.#active = true;
    this.#playing = true;
    this.#owner.wake();
    return this;
  }
  pause(): this {
    this.#playing = false;
    this.#owner.wake();
    return this;
  }
  stop(): this {
    this.#active = false;
    this.#playing = false;
    this.#clock = bounds(this.animation)[this.#speed < 0 ? 1 : 0];
    this.#frozen = false;
    this.#entered = true;
    this.#owner.wake();
    return this;
  }
  advance(dt: number): AnimaEvent[] {
    finite(dt);
    if (dt < 0) throw Error('anima: advance needs dt ≥ 0');
    const events: AnimaEvent[] = [];
    this.didLoop = false;
    if (!this.#active || !this.#playing) return events;
    if (this.#entered && this.#owner.player.reducedMotion && this.animation.reduced !== 'play') {
      const end = this.animation.reduced === 'end';
      this.#clock = this.#owner.reduce(
        this.animation,
        this.#speed / (timing.get(this.animation)?.speed || 1),
        end,
        this.name,
        events,
      );
      this.#frozen = true;
      this.#entered = false;
      this.#playing = false;
      return events;
    }
    const a = this.#clock,
      b = a + dt * this.#speed;
    const [lo, hi] = bounds(this.animation),
      d = hi - lo;
    this.didLoop =
      this.#loop === 'once'
        ? (!reached(lo, a) && reached(lo, b)) || (!reached(a, hi) && reached(b, hi))
        : timeFloor(a - lo, d) !== timeFloor(b - lo, d);
    crossings(this.animation, a, b, this.#entered, this.name, events, this.#loop);
    this.#entered = false;
    this.#clock = this.#loop === 'once' ? Math.max(lo, Math.min(hi, b)) : b;
    return events;
  }
  apply(mix = this.mix): this {
    this.mix = mix;
    this.#active = true;
    this.#owner.wake();
    return this;
  }
  sampleInto(values: Value[]): void {
    if (!this.#active || !this.#mix) return;
    const time = position(this.animation, this.#clock, this.#frozen ? 'once' : this.#loop);
    for (const track of this.animation.tracks) {
      const index = this.#owner.slots.get(track.addr)!;
      const prop = this.#owner.player.model.addrs.get(track.addr)!.prop;
      const discrete = ['int', 'uint', 'string', 'reference', 'bool'].includes(prop.type);
      values[index] = mixValue(
        values[index]!,
        sample(track, time, this.#owner.player),
        this.#mix,
        discrete,
      );
    }
  }
}
export class MachineInstance {
  readonly name: string;
  readonly player: Player;
  #owner: MotionRuntime;
  #active = true;
  #playing = true;
  #mix = 1;
  constructor(owner: MotionRuntime, name: string, player: Player) {
    this.#owner = owner;
    this.name = name;
    this.player = player;
  }
  get mix(): number {
    return this.#mix;
  }
  set mix(v: number) {
    this.#mix = Math.max(0, Math.min(1, finite(v)));
    this.#owner.wake();
  }
  set(name: string, value: number | boolean): void {
    this.player.set(name, value);
    this.#owner.wake();
  }
  fire(name: string): void {
    this.player.fire(name);
    this.#owner.wake();
  }
  get(name: string): import('../../../packages/core/src/load.ts').Value | undefined {
    return this.player.get(name);
  }
  states(): Record<string, string> {
    return this.player.states();
  }
  play(): void {
    this.#active = true;
    this.#playing = true;
    this.#owner.wake();
  }
  pause(): void {
    this.#playing = false;
    this.#owner.wake();
  }
  stop(): void {
    this.#active = false;
    this.#playing = false;
    this.#owner.wake();
  }
  compose(dt: number, values: Value[], events: AnimaEvent[]): boolean {
    if (!this.#active) return true;
    let settled = true;
    if (this.#playing) {
      this.player.reducedMotion = this.#owner.player.reducedMotion;
      const r = this.player.step(dt, (a) => values[this.#owner.slots.get(a)!]);
      settled = r.settled;
      events.push(...r.events.map((e) => ({ ...e, layer: this.name + '/' + e.layer })));
    }
    if (this.#mix)
      for (const address of this.player.writes()) {
        const prop = this.player.model.addrs.get(address)!;
        const value = this.player.prop(prop.node, prop.key)!;
        const i = this.#owner.slots.get(address)!;
        values[i] = mixValue(
          values[i]!,
          value,
          this.#mix,
          ['int', 'uint', 'string', 'reference', 'bool'].includes(prop.prop.type),
        );
      }
    return settled;
  }
}
export interface NodeHandle<T extends NodeType = NodeType> {
  readonly id: string;
  readonly type: T;
  get(key: string): number | boolean | string | readonly number[] | undefined;
  readonly local: readonly number[];
  readonly world: readonly number[];
}
export interface MotionAPI {
  readonly animations: AnimationInfo[];
  timeline(name: string): TimelineInstance;
  createTimeline(name: string, options?: TimelineOptions): TimelineInstance;
  machine(name: string): MachineInstance;
  node<T extends NodeType>(id: string, type?: T): NodeHandle<T> | undefined;
  seek(name: string, seconds: number): TimelineInstance;
  scrub(name: string, progress: number): TimelineInstance;
  applyTimeline(name: string, seconds: number, options?: { mix?: number }): TimelineInstance;
}
declare module '../../../packages/core/src/player.ts' {
  interface Player extends MotionAPI {
    readonly animations: MotionAPI['animations'];
  }
}
const runtimes = new WeakMap<Player, MotionRuntime>();
export const exits = new WeakMap<object, number>();
export class MotionRuntime implements PlaybackPolicy {
  readonly player: Player;
  readonly slots: Map<string, number>;
  readonly instances: (TimelineInstance | MachineInstance)[] = [];
  readonly timelines = new Map<string, TimelineInstance>();
  readonly machines = new Map<string, MachineInstance>();
  readonly definitions: Map<string, Model>;
  readonly PlayerClass: typeof Player;
  #changed = false;
  readonly clocks: StateClocks;
  constructor(player: Player, definitions: Map<string, Model>, PlayerClass: typeof Player) {
    this.player = player;
    this.clocks = new StateClocks(player);
    this.definitions = definitions;
    this.PlayerClass = PlayerClass;
    this.slots = new Map(player.addrs.map((a, i) => [a, i]));
    runtimes.set(player, this);
  }
  get busy(): boolean {
    return this.#changed;
  }
  states(): Record<string, string> {
    return Object.fromEntries(
      [...this.machines].flatMap(([name, m]) =>
        Object.entries(m.states()).map(([layer, state]) => [name + '/' + layer, state]),
      ),
    );
  }
  inspect(): import('../../../packages/core/src/player.ts').LayerInspect[] {
    return [...this.machines].flatMap(([name, m]) =>
      m.player.inspect().map((l) => ({ ...l, layer: name + '/' + l.layer })),
    );
  }
  wake(): void {
    this.#changed = true;
    this.player.onChange?.();
  }
  enter = (
    run: object,
    from: StateM | undefined,
    to: StateM,
    tr: TransitionM | undefined,
    carry: number,
  ) => this.clocks.enter(run, from, to, tr, carry);
  prepare = (run: object, s: StateM, dt: number, eligible: (t: TransitionM) => boolean) =>
    this.clocks.prepare(run, s, dt, eligible);
  rest = (_run: object, s: StateM) => this.clocks.controlled(s);
  local(t: TimelineM, elapsed: number, _speed: number, run: object): number {
    return position(t, this.clocks.raw(run, elapsed));
  }
  duration = (t: TimelineM, speed: number, run: object) => this.clocks.duration(t, speed, run);
  finished = (t: TimelineM, elapsed: number, run: object) => this.clocks.finished(t, elapsed, run);
  resume = (run: object, time: number) => this.clocks.resume(run, time);
  reduce(t: TimelineM, speed: number, end: boolean, layer: string, events: AnimaEvent[]): number {
    const [a, b] = bounds(t),
      reverse = speed * (timing.get(t)?.speed ?? 1) < 0;
    const start = reverse ? b : a,
      finish = reverse ? a : b;
    if (end) crossings(t, start, finish, true, layer, events, 'once');
    return end ? finish : start;
  }
  events(
    t: TimelineM,
    a: number,
    b: number,
    closed: boolean,
    layer: string,
    out: AnimaEvent[],
    _speed: number,
    run: object,
    source?: [number, string][],
  ): void {
    // Seeking/holding never synthesizes timeline crossings.
    if (this.clocks.isControlled(run)) return;
    const before = V ? out.length : 0;
    crossings(
      t,
      this.clocks.raw(run, a),
      this.clocks.raw(run, b),
      closed && !this.clocks.synced(run),
      layer,
      out,
      t.loop,
      source,
    );
    if (V && capturing) {
      const span = (b - a) * _speed * (timing.get(t)?.speed ?? 1);
      const fraction = !span ? 0 : (this.clocks.raw(run, b) - this.clocks.raw(run, a)) / span;
      for (const e of out.slice(before) as CapturedEvent[]) {
        e[occurrence] = (e[occurrence] ?? 0) * fraction;
        if (closed) stampEntryEvent(e, ((e[occurrence] ?? 0) - 1) * (b - a));
      }
    }
  }
  gate(t: TransitionM, st: StateM, elapsed: number, run: object): boolean {
    const threshold = exits.get(t);
    return (
      this.clocks.gate(run, st, t, elapsed) &&
      (threshold === undefined ||
        reached(
          elapsed *
            Math.abs(st.speed * (timing.get(this.player.model.timelines[st.play!]!)?.speed ?? 1)),
          threshold,
        ))
    );
  }
  carry(t: TransitionM, st: StateM, elapsed: number, run: object): number | undefined {
    const threshold = exits.get(t);
    return threshold === undefined
      ? this.clocks.carry(run, st, t, elapsed)
      : Math.max(
          0,
          elapsed -
            (threshold &&
              threshold /
                Math.abs(
                  st.speed * (timing.get(this.player.model.timelines[st.play!]!)?.speed ?? 1),
                )),
        );
  }
  pivot(p: Player, node: number): [number, number] {
    const rest = p.model.nodes[node]!.raw.pivot ?? [0, 0];
    return [p.num(node, 'pivotX', rest[0]), p.num(node, 'pivotY', rest[1])];
  }
  compose(dt: number, values: Value[], events: AnimaEvent[]): boolean {
    this.#changed = false;
    let settled = true;
    for (const i of this.instances) {
      if (i instanceof TimelineInstance) {
        events.push(...i.advance(dt));
        i.sampleInto(values);
        if (i.playing && i.speed !== 0) settled = false;
      } else if (!i.compose(dt, values, events)) settled = false;
    }
    return settled && !this.#changed;
  }
}
export function install(
  PlayerClass: typeof Player,
  sampler: typeof sampleTrack,
  mixer: typeof mixValues,
  resolver: typeof resolveAddress,
): void {
  sample = sampler;
  blend = mixer;
  resolve = resolver;
  const runtime = (p: Player) => {
    const r = runtimes.get(p);
    if (!r) throw Error('anima: requires motion');
    return r;
  };
  const methods = {
    timeline(this: Player, name: string) {
      const r = runtime(this);
      let t = r.timelines.get(name);
      if (!t) {
        t = this.createTimeline(name);
        r.timelines.set(name, t);
      }
      return t;
    },
    createTimeline(this: Player, name: string, options: TimelineOptions = {}) {
      const r = runtime(this),
        t = this.model.timelines.find((t) => t.name === name);
      if (!t) throw Error('anima: unknown timeline ' + name);
      const instance = new TimelineInstance(r, t, options);
      if (r.instances.some((i) => i.name === instance.name))
        throw Error('anima: duplicate instance ' + instance.name);
      r.instances.push(instance);
      r.wake();
      return instance;
    },
    machine(this: Player, name: string) {
      const r = runtime(this);
      let instance = r.machines.get(name);
      if (!instance) {
        const m = r.definitions.get(name);
        if (!m) throw Error('anima: unknown machine ' + name);
        if (r.instances.some((i) => i.name === name))
          throw Error('anima: duplicate instance ' + name);
        instance = new MachineInstance(
          r,
          name,
          new r.PlayerClass(m, { reducedMotion: this.reducedMotion }),
        );
        r.instances.push(instance);
        r.machines.set(name, instance);
        r.wake();
      }
      return instance;
    },
    node<T extends NodeType>(this: Player, id: string, type?: T): NodeHandle<T> | undefined {
      runtime(this);
      const index = this.model.ids.get(id);
      if (index === undefined) return;
      const n = this.model.nodes[index]!;
      if (type && n.type !== type) return;
      const local = () => [...this.local(index)],
        world = () => [...this.world(index)];
      return {
        id: n.id,
        type: n.type as T,
        get: (key: string) => {
          const a = resolve(id + '.' + key, this.model.nodes, this.model.ids);
          const v = Array.isArray(a)
            ? this.prop(index, key)
            : this.model.addrs.has(id + '.' + key)
              ? this.prop(index, key)
              : a.rest;
          return Array.isArray(v) ? [...v] : typeof v === 'object' ? undefined : v;
        },
        get local() {
          return local();
        },
        get world() {
          return world();
        },
      };
    },
    seek(this: Player, name: string, seconds: number) {
      return this.timeline(name).seek(seconds);
    },
    scrub(this: Player, name: string, progress: number) {
      return this.timeline(name).scrub(progress);
    },
    applyTimeline(this: Player, name: string, seconds: number, options: { mix?: number } = {}) {
      const i = this.timeline(name).pause().seek(seconds);
      i.mix = options.mix ?? 1;
      return i;
    },
  };
  Object.defineProperties(PlayerClass.prototype, Object.getOwnPropertyDescriptors(methods));
  Object.defineProperty(PlayerClass.prototype, 'animations', {
    configurable: true,
    get: function (this: Player) {
      return this.model.timelines.map(metadata);
    },
  });
}
