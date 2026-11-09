import type { Module } from '../../../packages/core/src/modules.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import { drawFrame, type Geometry } from '../../../packages/core/src/draw.ts';
import { apply, clamp, IDENTITY, invert, mul, type Mat } from '../../../packages/core/src/geom.ts';
import { flatten, parsePath } from '../../../packages/core/src/path.ts';
import {
  compose,
  decompose,
  registerConstraint,
  type Constraint,
  type RigContext,
} from '../../rig/core/api.ts';
import { after } from '../manifest.ts';

type Box = [number, number, number, number];
type State = { x: number; y: number; maxX: number; maxY: number };
type ScrollSpec = { node: number; k: number; raw: Constraint; viewport: number };
type ThumbSpec = { node: number; raw: Constraint; scroll: ScrollSpec; track: number };
type Specs = { scrolls: ScrollSpec[]; thumbs: ThumbSpec[] };
type InputController = {
  pointer(
    kind: 'move' | 'down' | 'up' | 'leave' | 'cancel',
    x?: number,
    y?: number,
    options?: { id?: number; button?: number },
  ): boolean;
  scroll(
    x: number,
    y: number,
    dx: number,
    dy: number,
    options?: { phase?: 'start' | 'move' | 'end' | 'cancel'; time?: number },
  ): boolean;
};
const states = new WeakMap<Player, Map<string, State>>();
const models = new WeakMap<Model, Specs>();
const queued = new WeakMap<Player, Map<string, [number, number]>>();
const drags = new WeakMap<
  Player,
  Map<number, { scroll: ScrollSpec; thumb?: ThumbSpec; x: number; y: number }>
>();
const decorated = new WeakSet<object>();
const number = { k: 'num' as const };
const key = (node: number, k: number) => node + ':' + k;

function geometryBox(g: Geometry | undefined): Box | undefined {
  if (!g) return;
  if (g.r !== undefined) return [g.cx! - g.r, g.cy! - g.r, 2 * g.r, 2 * g.r];
  if (g.width !== undefined) return [g.x ?? 0, g.y ?? 0, g.width, g.height ?? 0];
  if (g.d !== undefined) {
    const pts = flatten(parsePath(g.d)).flatMap((p) => p.pts);
    if (!pts.length) return;
    const xs = pts.filter((_, i) => !(i & 1)),
      ys = pts.filter((_, i) => i & 1),
      x = Math.min(...xs),
      y = Math.min(...ys);
    return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
  }
}

function bounds(p: Player, root: number): Box | undefined {
  const n = p.model.nodes[root]!;
  if ((n.type as string) === 'layout') {
    const b = p.layoutBox?.(n.id);
    if (b) return [b.x, b.y, b.width, b.height];
  }
  const frame = drawFrame(p),
    points: [number, number][] = [];
  const visit = (i: number, m: Mat) => {
    const box = geometryBox(frame.nodes[i]?.geometry);
    if (box) {
      const [x, y, w, h] = box;
      points.push(apply(m, x, y), apply(m, x + w, y), apply(m, x, y + h), apply(m, x + w, y + h));
    }
    for (const child of p.model.nodes[i]!.children)
      visit(child, mul(m, frame.nodes[child]?.transform ?? IDENTITY));
  };
  visit(root, IDENTITY);
  if (!points.length) return;
  const xs = points.map((q) => q[0]),
    ys = points.map((q) => q[1]),
    x = Math.min(...xs),
    y = Math.min(...ys);
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}

function metrics(ctx: RigContext, node: number, raw: Constraint) {
  const viewport = ctx.model.ids.get(raw.viewport),
    content = bounds(ctx.player, node),
    view = viewport === undefined ? undefined : bounds(ctx.player, viewport);
  return {
    content,
    view,
    max: [
      Math.max(0, (content?.[2] ?? 0) - (view?.[2] ?? 0)),
      Math.max(0, (content?.[3] ?? 0) - (view?.[3] ?? 0)),
    ] as [number, number],
  };
}

function current(ctx: RigContext, node: number, raw: Constraint, k: number): State {
  let map = states.get(ctx.player);
  if (!map) states.set(ctx.player, (map = new Map()));
  const id = key(node, k),
    old = map.get(id),
    [maxX, maxY] = metrics(ctx, node, raw).max,
    drivenX = ctx.model.addrs.has(ctx.model.nodes[node]!.id + `.constraints.${k}.offsetX`),
    drivenY = ctx.model.addrs.has(ctx.model.nodes[node]!.id + `.constraints.${k}.offsetY`),
    axis = raw.axis ?? 'both',
    x =
      axis === 'y'
        ? 0
        : clamp(drivenX || !old ? ctx.num(node, k, 'offsetX', raw.offsetX ?? 0) : old.x, 0, maxX),
    y =
      axis === 'x'
        ? 0
        : clamp(drivenY || !old ? ctx.num(node, k, 'offsetY', raw.offsetY ?? 0) : old.y, 0, maxY),
    next = { x, y, maxX, maxY };
  map.set(id, next);
  return next;
}

function contains(p: Player, node: number, x: number, y: number): boolean {
  const n = p.model.nodes[node]!,
    box = bounds(p, node);
  if (!box) return false;
  const parent = n.parent,
    matrix =
      (n.type as string) === 'layout' ? (parent < 0 ? IDENTITY : p.world(parent)) : p.world(node),
    inv = invert(matrix);
  if (!inv) return false;
  const point = apply(inv, x, y);
  return (
    point[0] >= box[0] &&
    point[1] >= box[1] &&
    point[0] <= box[0] + box[2] &&
    point[1] <= box[1] + box[3]
  );
}

function move(p: Player, spec: ScrollSpec, dx: number, dy: number): boolean {
  if (spec.raw.interactive === false) return false;
  const state = states.get(p)?.get(key(spec.node, spec.k));
  if (!state) return false;
  let q = queued.get(p);
  if (!q) queued.set(p, (q = new Map()));
  const old = q.get(key(spec.node, spec.k)) ?? [state.x, state.y],
    axis = spec.raw.axis ?? 'both',
    id = p.model.nodes[spec.node]!.id,
    drivenX = p.model.addrs.has(id + `.constraints.${spec.k}.offsetX`),
    drivenY = p.model.addrs.has(id + `.constraints.${spec.k}.offsetY`),
    x = axis === 'y' ? 0 : drivenX ? old[0] : clamp(old[0] + dx, 0, state.maxX),
    y = axis === 'x' ? 0 : drivenY ? old[1] : clamp(old[1] + dy, 0, state.maxY);
  if (x === old[0] && y === old[1]) return false;
  q.set(key(spec.node, spec.k), [x, y]);
  return true;
}

function moveThumb(
  p: Player,
  thumb: ThumbSpec,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const spec = thumb.scroll,
    state = states.get(p)?.get(key(spec.node, spec.k)),
    axis = thumb.raw.axis === 'x' ? 0 : 1,
    trackBox = bounds(p, thumb.track),
    thumbBox = bounds(p, thumb.node),
    viewBox = bounds(p, spec.viewport),
    contentBox = bounds(p, spec.node);
  if (!state || !trackBox || !thumbBox || !viewBox || !contentBox) return false;
  const track = trackBox[axis + 2],
    authored = thumbBox[axis + 2],
    viewport = viewBox[axis + 2],
    content = contentBox[axis + 2],
    length = thumb.raw.resize
      ? Math.min(track, Math.max(authored, content ? (track * viewport) / content : track))
      : authored,
    travel = track - length,
    max = axis ? state.maxY : state.maxX,
    inv = invert(p.world(thumb.track));
  if (!travel || !max || !inv) return false;
  const a = apply(inv, x0, y0),
    b = apply(inv, x1, y1),
    delta = ((b[axis] - a[axis]) / travel) * max;
  return move(p, spec, axis ? 0 : delta, axis ? delta : 0);
}

function applyQueued(p: Player): void {
  const q = queued.get(p);
  if (!q?.size) return;
  const map = states.get(p);
  for (const [id, [x, y]] of q) {
    const state = map?.get(id);
    if (state) {
      state.x = x;
      state.y = y;
    }
  }
  q.clear();
  activeRig?.context(p)?.invalidate();
}

function installInput(player: Player, controller: InputController): InputController {
  if (decorated.has(controller)) return controller;
  decorated.add(controller);
  const pointer = controller.pointer.bind(controller),
    scroll = controller.scroll.bind(controller);
  controller.pointer = (kind, x = 0, y = 0, options = {}) => {
    const id = options.id ?? 0,
      specs = models.get(player.model),
      active = drags.get(player) ?? new Map(),
      previous = active.get(id);
    let moved = false;
    if (kind === 'down' && (options.button ?? 0) === 0 && specs) {
      const thumb = [...specs.thumbs].reverse().find((s) => contains(player, s.node, x, y)),
        spec =
          thumb?.scroll ??
          [...specs.scrolls].reverse().find((s) => contains(player, s.viewport, x, y));
      if (spec && spec.raw.interactive !== false) {
        active.set(id, { scroll: spec, thumb, x, y });
        drags.set(player, active);
      }
    } else if (kind === 'move' && previous) {
      moved = previous.thumb
        ? moveThumb(player, previous.thumb, previous.x, previous.y, x, y)
        : move(player, previous.scroll, x - previous.x, y - previous.y);
      previous.x = x;
      previous.y = y;
    } else if (kind !== 'move') active.delete(id);
    return pointer(kind, x, y, options) || moved;
  };
  controller.scroll = (x, y, dx, dy, options = {}) => {
    const specs = models.get(player.model),
      spec = specs && [...specs.scrolls].reverse().find((s) => contains(player, s.viewport, x, y)),
      moved = !!spec && move(player, spec, dx, dy);
    return scroll(x, y, dx, dy, options) || moved;
  };
  return controller;
}

export function scrollState(player: Player, node: number, k: number): State | undefined {
  return states.get(player)?.get(key(node, k));
}

let activeRig: { context(player: Player): RigContext | undefined } | undefined;

export const scroll: Module = {
  name: 'scroll',
  after,
  entries: [],
  init(registry, shared) {
    activeRig = registry.get('rig') as typeof activeRig;
    const proto = shared.Player.prototype as typeof shared.Player.prototype & {
      scrollInput?: boolean;
      input(): InputController;
    };
    if (!proto.scrollInput) {
      proto.scrollInput = true;
      const input = proto.input;
      Object.defineProperty(proto, 'input', {
        configurable: true,
        value: function (this: Player) {
          return installInput(this, input.call(this));
        },
      });
    }
    registerConstraint({
      kind: 'scroll',
      shape: {
        k: 'obj',
        p: {
          viewport: { k: 'str', feature: 'scroll' },
          axis: { k: 'str', of: ['x', 'y', 'both'] },
          offsetX: number,
          offsetY: number,
          interactive: { k: 'bool' },
        },
        req: ['viewport'],
      },
      targets: (raw, model) => (model.ids.has(raw.viewport) ? [raw.viewport] : []),
      solve(ctx, node, raw, k) {
        const s = current(ctx, node, raw, k);
        return mul(ctx.world(node), [1, 0, 0, 1, -s.x, -s.y]);
      },
    });
    registerConstraint({
      kind: 'scrollThumb',
      shape: {
        k: 'obj',
        p: {
          scroll: { k: 'str', feature: 'scroll' },
          track: { k: 'str', feature: 'scroll' },
          axis: { k: 'str', of: ['x', 'y'] },
          resize: { k: 'bool' },
        },
        req: ['scroll', 'track'],
      },
      targets: (raw) => [raw.scroll, raw.track],
      solve(ctx, node, raw) {
        const content = ctx.model.ids.get(raw.scroll),
          track = ctx.model.ids.get(raw.track);
        if (content === undefined || track === undefined) return;
        const constraints = ctx.model.nodes[content]!.raw.constraints ?? [],
          k = constraints.findIndex((c: Constraint) => c.kind === 'scroll'),
          source = constraints[k];
        if (k < 0 || !source) return;
        const state = current(ctx, content, source, k),
          axis = raw.axis === 'x' ? 0 : 1,
          trackBox = bounds(ctx.player, track),
          thumbBox = bounds(ctx.player, node),
          measure = metrics(ctx, content, source),
          trackLen = trackBox?.[axis + 2] ?? 0,
          authored = thumbBox?.[axis + 2] ?? 0,
          viewport = measure.view?.[axis + 2] ?? 0,
          contentLen = measure.content?.[axis + 2] ?? 0;
        if (!trackBox || !thumbBox || !trackLen || !authored) return;
        const length = raw.resize
            ? Math.min(
                trackLen,
                Math.max(authored, contentLen ? (trackLen * viewport) / contentLen : trackLen),
              )
            : authored,
          percent = axis
            ? state.maxY
              ? state.y / state.maxY
              : 0
            : state.maxX
              ? state.x / state.maxX
              : 0,
          start = trackBox[axis] + (trackLen - length) * percent,
          values = decompose(ctx.world(node)),
          scale = length / authored;
        if (raw.resize) values[axis + 3] *= scale;
        const desired = compose(values),
          point = apply(desired, thumbBox[0], thumbBox[1]),
          target = axis
            ? apply(ctx.world(track), trackBox[0], start)
            : apply(ctx.world(track), start, trackBox[1]);
        values[0] += target[0] - point[0];
        values[1] += target[1] - point[1];
        return compose(values);
      },
    });
    const values = shared.Player.prototype.values;
    shared.Player.prototype.values = function () {
      const out = values.call(this);
      for (const [id, s] of states.get(this) ?? []) {
        const [node, k] = id.split(':').map(Number),
          prefix = this.model.nodes[node!]!.id + `.constraints.${k}`;
        out[prefix + '.percentX'] = s.maxX ? s.x / s.maxX : 0;
        out[prefix + '.percentY'] = s.maxY ? s.y / s.maxY : 0;
      }
      return out;
    };
    return scroll;
  },
  load(model) {
    if (!model.doc.requires?.includes('scroll')) return;
    const scrolls: ScrollSpec[] = [];
    for (const [node, n] of model.nodes.entries())
      for (const [k, raw] of (n.raw.constraints ?? []).entries())
        if (raw.kind === 'scroll') {
          const viewport = model.ids.get(raw.viewport);
          if (viewport !== undefined) scrolls.push({ node, k, raw, viewport });
        }
    const thumbs: ThumbSpec[] = [];
    for (const [node, n] of model.nodes.entries())
      for (const raw of n.raw.constraints ?? [])
        if (raw.kind === 'scrollThumb') {
          const content = model.ids.get(raw.scroll),
            track = model.ids.get(raw.track),
            source = scrolls.find((s) => s.node === content);
          if (source && track !== undefined) thumbs.push({ node, raw, scroll: source, track });
        }
    models.set(model, { scrolls, thumbs });
    const previous = model.prepareInputs;
    model.prepareInputs = (player, scope, dt) => {
      previous?.(player, scope, dt);
      applyQueued(player);
    };
  },
};
