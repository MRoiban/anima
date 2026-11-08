import type { ListenerM, Model } from '../../../packages/core/src/load.ts';
import type { Player, PointerKind } from '../../../packages/core/src/player.ts';
import { drawWorld } from '../../../packages/core/src/draw.ts';
import { apply, invert, mul } from '../../../packages/core/src/geom.ts';
import type {
  Cursor,
  Data,
  GamepadRecord,
  InputListener,
  KeyOptions,
  PointerEventKind,
  PointerOptions,
  ScrollOptions,
} from './types.ts';
export const configurations = new WeakMap<Model['inputs'], InputListener[]>();
let peers: ReadonlyMap<string, import('../../../packages/core/src/modules.ts').Module>;
const controllers = new WeakMap<Player, InputController>();
const installed = new WeakSet<typeof Player>();
interface Delivery {
  handled: boolean;
  consumed: boolean;
}
interface Contact {
  x: number;
  y: number;
  startX: number;
  startY: number;
  button: number;
  over: Set<number>;
  pressed: Set<number>;
  drag: boolean;
  moved: number;
  origins: Map<number, [number, number]>;
}
const finite = (...v: number[]) => {
  if (!v.every(Number.isFinite)) throw Error('anima: input coordinates must be finite');
};
export interface HitOptions {
  bounded?: boolean;
  scroll?: boolean;
}
export class InputController {
  enabled = true;
  /** Optional focus-module target; explicit key options take precedence. */
  keyTarget?: string;
  readonly contacts = new Map<number, Contact>();
  readonly disabled = new Set<number>();
  readonly pads = new Map<number, GamepadRecord>();
  private latch?: { targets: Set<number>; time: number };
  readonly player: Player;
  constructor(player: Player) {
    this.player = player;
  }
  get listeners(): InputListener[] {
    return configurations.get(this.player.model.inputs) ?? [];
  }
  private eligible(node: number): boolean {
    const p = this.player;
    if (node < 0) return true;
    if (!p.visible(node)) return false;
    for (let n = node; n >= 0; n = p.model.nodes[n]!.parent)
      if (p.prop(n, 'pointerEnabled') === false) return false;
    return true;
  }
  private ancestor(parent: number, child: number): boolean {
    if (parent < 0) return true;
    for (let n = child; n >= 0; n = this.player.model.nodes[n]!.parent)
      if (n === parent) return true;
    return false;
  }
  private hits(l: InputListener, x: number, y: number): boolean {
    return this.eligible(l.target) && this.player.hits(l.action, x, y);
  }
  /** Hit targets in reverse authored node order; an opaque target keeps its ancestor chain. */
  targets(x: number, y: number, options: HitOptions = {}): Set<number> {
    finite(x, y);
    const p = this.player,
      out = new Set<number>();
    if (options.bounded) {
      const [a, b, w, h] = p.model.viewBox;
      if (x < a || y < b || x > a + w || y > b + h) return out;
    }
    const candidates = this.listeners.filter((l) => this.hits(l, x, y));
    const extras = p.model.nodes
      .map((node, target) => ({ node, target }))
      .filter(
        ({ node, target }) =>
          (node.raw.opaque || node.raw.cursor) &&
          this.eligible(target) &&
          p.hits({ target, pad: 0 } as ListenerM, x, y),
      );
    const blockers = [...candidates.map((l) => l.target), ...extras.map((e) => e.target)].filter(
      (n) => n >= 0 && p.model.nodes[n]!.raw.opaque,
    );
    const blocker = blockers.length ? Math.max(...blockers) : undefined;
    const accepts = (target: number) =>
      blocker === undefined || target >= blocker || this.ancestor(target, blocker);
    for (const l of candidates)
      if ((!options.scroll || l.on.includes('scroll')) && accepts(l.target)) out.add(l.target);
    if (!options.scroll) for (const e of extras) if (accepts(e.target)) out.add(e.target);
    return out;
  }
  hitTest(x: number, y: number, options: HitOptions = {}): string[] {
    return [...this.targets(x, y, options)]
      .sort((a, b) => b - a)
      .map((n) => (n < 0 ? '@icon' : this.player.model.nodes[n]!.id));
  }
  occludes(x: number, y: number, options: HitOptions = {}): boolean {
    return [...this.targets(x, y, { ...options, scroll: false })].some(
      (n) =>
        n >= 0 &&
        !!this.player.model.nodes[n]!.raw.opaque &&
        (!options.scroll || this.listeners.some((l) => l.target === n && l.on.includes('scroll'))),
    );
  }
  get cursor(): Cursor | undefined {
    const over = new Set([...this.contacts.values()].flatMap((c) => [...c.over]));
    for (const n of [...over].sort((a, b) => b - a)) {
      const value = n >= 0 && this.player.model.nodes[n]!.raw.cursor;
      if (value) return value;
    }
    return undefined;
  }
  private dispatch(
    on: string,
    targets: Set<number>,
    data: Data,
    filter: (l: InputListener) => boolean = () => true,
  ): boolean {
    if (!this.enabled) return false;
    return this.deliver(on, targets, data, filter).handled;
  }
  private deliver(
    on: string,
    targets: Set<number>,
    data: Data,
    filter: (l: InputListener) => boolean = () => true,
  ): Delivery {
    if (!this.enabled) return { handled: false, consumed: false };
    const ls = this.listeners.filter(
      (l) =>
        l.on.includes(on) &&
        targets.has(l.target) &&
        (on.startsWith('key-') || on.startsWith('gamepad-')
          ? l.target < 0 || this.player.visible(l.target)
          : this.eligible(l.target)) &&
        filter(l),
    );
    ls.sort(
      (a, b) =>
        Number(!!b.capture) - Number(!!a.capture) ||
        (a.capture ? a.depth - b.depth : b.depth - a.depth) ||
        a.order - b.order,
    );
    let claimed = false;
    for (const l of ls) {
      this.player.act(l.action);
      const values = { ...data };
      if (l.align && data.x !== undefined && data.y !== undefined && l.target >= 0) {
        const n = this.player.model.nodes[l.target]!,
          inv = n.parent < 0 ? undefined : invert(drawWorld(this.player, n.parent));
        const [x, y] =
          n.parent < 0
            ? [Number(data.x), Number(data.y)]
            : inv
              ? apply(inv, Number(data.x), Number(data.y))
              : [NaN, NaN];
        if (!Number.isFinite(x + y)) continue;
        const contact = this.contacts.get(Number(data.pointerId));
        const origin = contact?.origins.get(l.target);
        values.x = x + (l.align === 'preserve' ? (origin?.[0] ?? 0) : 0);
        values.y = y + (l.align === 'preserve' ? (origin?.[1] ?? 0) : 0);
      }
      // seam(P6-7): resolve text listener coordinates in the target's local space.
      if (
        l.write?.['text-index'] &&
        data.x !== undefined &&
        data.y !== undefined &&
        l.target >= 0
      ) {
        const inv = invert(drawWorld(this.player, l.target));
        const text = peers?.get('text') as
          import('../../text/core/index.ts').TextModule | undefined;
        if (inv && text?.hitTest) {
          const [x, y] = apply(inv, Number(data.x), Number(data.y));
          values['text-index'] = text.hitTest(this.player, l.target, x, y);
        }
      }
      for (const [field, name] of Object.entries(l.write ?? {})) {
        const value = values[field as keyof Data];
        if (value !== undefined) this.player.set(name, value);
      }
      claimed = true;
      if (l.consume || (on.startsWith('key-') && !l.capture && !l.propagate))
        return { handled: true, consumed: true };
    }
    return { handled: claimed, consumed: false };
  }
  private children() {
    const p = this.player;
    const nested = (p.nested as { players?: Map<string, Player> } | undefined)?.players;
    const children = [...(nested ?? [])].map(([id, player]) => ({
      id,
      player,
      node: p.model.ids.get(id)!,
      matrix: drawWorld(p, p.model.ids.get(id)!),
    }));
    const lists = peers?.get('lists') as
      typeof import('../../lists/core/index.ts').lists | undefined;
    for (const run of lists?.listState(p)?.runs ?? []) {
      const raw = p.model.nodes[run.spec.node]!.raw;
      for (const item of run.items)
        children.push({
          id: p.model.nodes[run.spec.node]!.id + '.' + item.index,
          player: item.player,
          node: run.spec.node,
          matrix: mul(drawWorld(p, run.spec.node), [
            1,
            0,
            0,
            1,
            (raw.dx ?? 0) * item.index,
            (raw.dy ?? 0) * item.index,
          ]),
        });
    }
    return children;
  }
  private route(kind: PointerEventKind, x: number, y: number, opts: PointerOptions): boolean {
    const children = this.children();
    if (!children.length) {
      if ((opts.id ?? 0) === 0 && (opts.button ?? 0) === 0)
        this.player.nested?.pointer(kind === 'cancel' ? 'leave' : kind, x, y);
      return false;
    }
    let claimed = false;
    const front = this.targets(x, y);
    const blockers = [...front].filter((n) => n >= 0 && this.player.model.nodes[n]!.raw.opaque);
    for (const { node, player: child, matrix } of children) {
      const inv = invert(matrix);
      const valid =
        inv && this.eligible(node) && !blockers.some((n) => n > node && !this.ancestor(n, node));
      const [lx, ly] = inv ? apply(inv, x, y) : [0, 0];
      if (configurations.has(child.model.inputs))
        claimed = child.input().pointer(valid ? kind : 'cancel', lx, ly, opts) || claimed;
      else if ((opts.id ?? 0) === 0 && (opts.button ?? 0) === 0)
        child.pointer(valid && kind !== 'cancel' ? kind : 'leave', lx, ly);
    }
    return claimed;
  }
  pointer(kind: PointerEventKind, x = 0, y = 0, opts: PointerOptions = {}): boolean {
    finite(x, y);
    const id = opts.id ?? 0,
      button = opts.button ?? 0;
    if (!Number.isInteger(id) || id < 0 || ![0, 1, 2].includes(button))
      throw Error('anima: invalid pointer id or button');
    if (!this.enabled || this.disabled.has(id)) return false;
    let c = this.contacts.get(id);
    if (kind === 'cancel' || kind === 'leave') {
      if (!c) return false;
      const data = {
        x: c.x,
        y: c.y,
        'pointer-x': c.x,
        'pointer-y': c.y,
        'pointer-delta-x': 0,
        'pointer-delta-y': 0,
        pointerId: id,
        button: c.button,
        dx: c.x - c.startX,
        dy: c.y - c.startY,
      };
      let claimed = false;
      if (kind === 'cancel') {
        claimed = this.dispatch('cancel', c.pressed, data);
        if (c.drag)
          claimed = this.dispatch('drag-end', c.pressed, { ...data, pressed: false }) || claimed;
      }
      claimed = this.dispatch('leave', c.over, data) || claimed;
      // An explicit exit cancels a press, matching the 0.1 pointer model.
      this.contacts.delete(id);
      return this.route(kind, c.x, c.y, opts) || claimed;
    }
    if (!c) {
      c = {
        x,
        y,
        startX: x,
        startY: y,
        button,
        over: new Set(),
        pressed: new Set(),
        drag: false,
        moved: 0,
        origins: new Map(),
      };
      this.contacts.set(id, c);
    }
    const now = this.targets(x, y),
      data: Data = {
        x,
        y,
        'pointer-x': x,
        'pointer-y': y,
        'pointer-delta-x': x - c.x,
        'pointer-delta-y': y - c.y,
        dx: x - c.startX,
        dy: y - c.startY,
        startX: c.startX,
        startY: c.startY,
        pointerId: id,
        button: kind === 'move' ? c.button : button,
      };
    const diff = (a: Set<number>, b: Set<number>) => new Set([...a].filter((x) => !b.has(x)));
    const match = (l: InputListener) => (l.button ?? 0) === data.button;
    let claimed = this.dispatch('leave', diff(c.over, now), data);
    claimed = this.dispatch('enter', diff(now, c.over), data) || claimed;
    if (kind === 'down') {
      this.player.focusPointer?.(
        x,
        y,
        (node) =>
          this.eligible(node) &&
          ![...now].some(
            (n) => n > node && this.player.model.nodes[n]!.raw.opaque && !this.ancestor(n, node),
          ),
      );
      c.startX = x;
      c.startY = y;
      c.button = button;
      c.pressed = now;
      c.drag = false;
      c.moved = 0;
      c.origins.clear();
      Object.assign(data, { dx: 0, dy: 0, startX: x, startY: y });
      for (const n of now)
        if (n >= 0) {
          const parent = this.player.model.nodes[n]!.parent,
            inv = parent < 0 ? undefined : invert(drawWorld(this.player, parent));
          const pt = parent < 0 ? [x, y] : inv ? apply(inv, x, y) : [x, y];
          c.origins.set(n, [
            this.player.num(n, 'x', 0) - pt[0]!,
            this.player.num(n, 'y', 0) - pt[1]!,
          ]);
        }
    }
    c.moved = Math.max(c.moved, Math.hypot(x - c.startX, y - c.startY));
    if (kind === 'move' && c.pressed.size && (c.drag || c.moved >= 0.5)) {
      if (!c.drag) {
        c.drag = true;
        claimed = this.dispatch('drag-start', c.pressed, data, match) || claimed;
      }
      claimed = this.dispatch('drag', c.pressed, data, match) || claimed;
    }
    claimed = this.dispatch(kind, now, data, match) || claimed;
    if (kind === 'up' && button === c.button) {
      if (c.drag)
        claimed =
          this.dispatch('drag-end', c.pressed, { ...data, pressed: false }, match) || claimed;
      else if (c.moved < 0.5)
        claimed =
          this.dispatch('click', new Set([...now].filter((n) => c!.pressed.has(n))), data, match) ||
          claimed;
      c.pressed = new Set();
      c.drag = false;
    }
    c.over = now;
    c.x = x;
    c.y = y;
    return this.route(kind, x, y, opts) || claimed;
  }
  enablePointer(id: number, enabled: boolean): void {
    if (!Number.isInteger(id) || id < 0) throw Error('anima: invalid pointer id');
    if (enabled) this.disabled.delete(id);
    else {
      this.pointer('cancel', 0, 0, { id });
      this.disabled.add(id);
    }
  }
  cancel(): void {
    for (const id of this.contacts.keys()) this.pointer('cancel', 0, 0, { id });
    this.cancelScroll();
  }
  key(kind: 'down' | 'up', key: string, opts: KeyOptions = {}): boolean {
    if (!this.enabled) return false;
    const handled = this.dispatchKey(kind, key, opts);
    const moved =
      !opts.control &&
      !opts.alt &&
      !opts.meta &&
      this.player.focusKey?.(key, kind === 'down', opts.shift);
    return !!moved || handled.handled;
  }
  private dispatchKey(kind: 'down' | 'up', key: string, opts: KeyOptions): Delivery {
    const p = this.player,
      name = opts.target ?? this.keyTarget ?? p.focused ?? undefined;
    const nested = name && this.children().find((c) => name.startsWith(c.id + '.'));
    const dot = nested ? nested.id.length : -1;
    const target = nested ? nested.node : name === undefined ? -1 : p.model.ids.get(name);
    if (target === undefined) throw Error('anima: unknown key target');
    const targets = new Set<number>([-1]);
    for (let n = target; n >= 0; n = p.model.nodes[n]!.parent) targets.add(n);
    const modifiers = ['shift', 'control', 'alt', 'meta']
      .filter((k) => opts[k as keyof KeyOptions])
      .join('+');
    const on = 'key-' + (kind === 'down' && opts.repeat ? 'repeat' : kind),
      data = { pressed: kind === 'down', 'key-pressed': key };
    const match = (l: InputListener) =>
      (!l.key || l.key === '*' || l.key === key) &&
      (l.modifiers === undefined || l.modifiers === modifiers);
    const capture = this.deliver(on, targets, data, (l) => !!l.capture && match(l));
    if (capture.consumed) return capture;
    let childResult: Delivery = { handled: false, consumed: false };
    if (dot >= 0 && p.visible(target)) {
      const child = nested && nested.player;
      if (!child) throw Error('anima: unknown key target');
      if (configurations.has(child.model.inputs))
        childResult = child
          .input()
          .dispatchKey(kind, key, { ...opts, target: name!.slice(dot + 1) });
      if (childResult.consumed) return { handled: true, consumed: true };
    }
    const bubble = this.deliver(on, targets, data, (l) => !l.capture && match(l));
    return {
      handled: capture.handled || childResult.handled || bubble.handled,
      consumed: bubble.consumed,
    };
  }
  scroll(x: number, y: number, deltaX: number, deltaY: number, opts: ScrollOptions = {}): boolean {
    finite(x, y, deltaX, deltaY);
    const time = opts.time ?? this.player.time;
    finite(time);
    if (!this.enabled) return false;
    if (opts.phase === 'cancel') {
      this.cancelScroll();
      return false;
    }
    if (
      this.latch &&
      (time < this.latch.time || time - this.latch.time > 0.15 || opts.phase === 'start')
    )
      this.cancelScroll();
    const targets = this.latch?.targets ?? this.targets(x, y, { scroll: true });
    const claimed = this.dispatch('scroll', targets, {
      x,
      y,
      deltaX,
      deltaY,
      dx: deltaX,
      dy: deltaY,
    });
    if (claimed) this.latch = { targets, time };
    if (opts.phase === 'end') this.cancelScroll();
    return claimed;
  }
  wantsScroll(x: number, y: number, time = this.player.time): boolean {
    finite(time);
    if (this.latch && (time < this.latch.time || time - this.latch.time > 0.15))
      this.cancelScroll();
    return (
      this.enabled && (this.latch !== undefined || this.targets(x, y, { scroll: true }).size > 0)
    );
  }
  cancelScroll(): void {
    this.latch = undefined;
  }
  gamepads(batch: readonly GamepadRecord[]): void {
    // Validate the complete batch before committing any connection/input state.
    const seen = new Set<number>();
    for (const r of batch) {
      if (
        !Number.isInteger(r.index) ||
        r.index < 0 ||
        seen.has(r.index) ||
        typeof r.connected !== 'boolean' ||
        r.axes?.some((x) => !Number.isFinite(x) || Math.abs(x) > 1) ||
        r.buttons?.some(
          (b) =>
            !Number.isFinite(b.value) ||
            b.value < 0 ||
            b.value > 1 ||
            typeof b.pressed !== 'boolean',
        )
      )
        throw Error('anima: invalid gamepad batch');
      seen.add(r.index);
    }
    if (!this.enabled) return;
    const targets = new Set(this.listeners.map((l) => l.target));
    for (const r of batch) {
      const prev = this.pads.get(r.index),
        match = (l: InputListener) =>
          (l.index === undefined || l.index === r.index) &&
          (!l.mapping || l.mapping === 'raw' || r.mapping === 'standard');
      if (r.connected && !prev)
        this.dispatch('gamepad-connected', targets, { index: r.index }, match);
      if (!r.connected && prev)
        this.dispatch('gamepad-disconnected', targets, { index: r.index }, match);
      if (r.connected) {
        r.axes?.forEach((value, control) => {
          if (value !== (prev?.axes?.[control] ?? 0))
            this.dispatch(
              'gamepad-axis',
              targets,
              { index: r.index, control, value },
              (l) => match(l) && (l.control === undefined || l.control === control),
            );
        });
        r.buttons?.forEach((b, control) => {
          const old = prev?.buttons?.[control] ?? { value: 0, pressed: false };
          if (b.value !== old.value || b.pressed !== old.pressed)
            this.dispatch(
              'gamepad-button',
              targets,
              { index: r.index, control, ...b },
              (l) =>
                match(l) &&
                (l.control === undefined || l.control === control) &&
                (!l.phase ||
                  l.phase === 'both' ||
                  (l.phase === 'press' ? b.pressed && !old.pressed : !b.pressed && old.pressed)),
            );
        });
        this.pads.set(r.index, {
          ...r,
          axes: r.axes?.slice(),
          buttons: r.buttons?.map((b) => ({ ...b })),
        });
      } else this.pads.delete(r.index);
    }
  }
}
export interface InputAPI {
  input(): InputController;
}
declare module '../../../packages/core/src/player.ts' {
  interface Player {
    input(): InputController;
  }
}
export function install(Class: typeof Player, modules: typeof peers): void {
  peers = modules;
  if (installed.has(Class)) return;
  installed.add(Class);
  const pointer = Class.prototype.pointer,
    visible = Class.prototype.visible,
    hits = Class.prototype.hits;
  Object.defineProperty(Class.prototype, 'input', {
    configurable: true,
    value: function (this: Player) {
      if (!configurations.has(this.model.inputs)) throw Error('anima: document requires input');
      let c = controllers.get(this);
      if (!c) controllers.set(this, (c = new InputController(this)));
      return c;
    },
  });
  Class.prototype.pointer = function (this: Player, kind: PointerKind, x = 0, y = 0) {
    if (configurations.has(this.model.inputs)) this.input().pointer(kind, x, y);
    else pointer.call(this, kind, x, y);
  };
  Class.prototype.hits = function (
    this: Player,
    listener: ListenerM,
    x: number,
    y: number,
  ): boolean {
    if (configurations.has(this.model.inputs) && listener.target >= 0) {
      if (!this.visible(listener.target)) return false;
      const node = this.model.nodes[listener.target]!;
      if (node.type === 'group')
        return node.children.some((target) => this.hits({ ...listener, target }, x, y));
    }
    return hits.call(this, listener, x, y);
  };
  Class.prototype.visible = function (this: Player, node: number): boolean {
    if (configurations.has(this.model.inputs))
      for (let n = node; n >= 0; n = this.model.nodes[n]!.parent) {
        if (this.prop(n, 'collapsed') === true) return false;
        const parent = this.model.nodes[n]!.parent;
        if (parent >= 0 && this.model.nodes[parent]!.raw.solo !== undefined) {
          const solo = this.num(parent, 'solo', -1);
          if (this.model.nodes[parent]!.children[solo] !== n) return false;
        }
      }
    return visible.call(this, node);
  };
}
