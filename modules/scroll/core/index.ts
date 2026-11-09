import type { Module } from '../../../packages/core/src/modules.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { drawFrame, type Geometry } from '../../../packages/core/src/draw.ts';
import { apply, clamp, IDENTITY, mul, type Mat } from '../../../packages/core/src/geom.ts';
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
const states = new WeakMap<Player, Map<string, State>>();
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

export function scrollState(player: Player, node: number, k: number): State | undefined {
  return states.get(player)?.get(key(node, k));
}

export const scroll: Module = {
  name: 'scroll',
  after,
  entries: [],
  init(_registry, shared) {
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
};
