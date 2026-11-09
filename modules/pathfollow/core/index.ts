import type { Module } from '../../../packages/core/src/modules.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { apply, invert, mul, type Mat } from '../../../packages/core/src/geom.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { nodePointer } from '../../components/core/node-pointer.ts';
import {
  blend,
  compose,
  decompose,
  registerConstraint,
  type Constraint,
  type RigContext,
} from '../../rig/core/api.ts';
import { entries as followEntries } from '../capabilities/rigging-follow-path/registry.ts';
import { entries as listEntries } from '../capabilities/rigging-list-follow-path/registry.ts';
import { lists as listModule } from '../../lists/core/index.ts';
import { after } from '../manifest.ts';
import { pathMeasure } from './measure.ts';

const number = { k: 'num' as const };
const boolean = { k: 'bool' as const };
let outlines: Module[] = [];
let activeRig: { context(player: Player): RigContext | undefined } | undefined;

function pivot(ctx: RigContext, node: number): number[] {
  const n = ctx.model.nodes[node]!;
  return (n.type as string) === 'bone' ? [0, 0] : (n.raw.pivot ?? [0, 0]);
}

function sample(
  ctx: RigContext,
  id: string,
  fraction: number,
): [number, number, number] | undefined {
  const target = ctx.model.ids.get(id);
  if (target === undefined) return;
  const local = pathMeasure(ctx.player, target, outlines)?.at(fraction);
  if (!local) return;
  const world = ctx.world(target),
    point = apply(world, local[0], local[1]),
    dx = world[0] * local[2] + world[2] * local[3],
    dy = world[1] * local[2] + world[3] * local[3];
  return [point[0], point[1], Math.atan2(dy, dx)];
}

function placed(
  ctx: RigContext,
  node: number,
  point: [number, number, number],
  orient: boolean,
  offset: boolean,
): Mat {
  const current = ctx.world(node),
    values = decompose(current, pivot(ctx, node));
  values[0] = point[0];
  values[1] = point[1];
  if (orient) values[2] = point[2];
  if (offset) {
    const n = ctx.model.nodes[node]!,
      parent = n.parent,
      frame = parent < 0 ? ([1, 0, 0, 1, 0, 0] as Mat) : ctx.world(parent),
      dx = ctx.player.num(node, 'x', n.raw.x ?? 0) - (n.raw.x ?? 0),
      dy = ctx.player.num(node, 'y', n.raw.y ?? 0) - (n.raw.y ?? 0);
    values[0] += frame[0] * dx + frame[2] * dy;
    values[1] += frame[1] * dx + frame[3] * dy;
  }
  return compose(values, pivot(ctx, node));
}

function spread(ctx: RigContext, node: number, raw: Constraint, k: number): void {
  const children = ctx.model.nodes[node]!.children,
    count = children.length,
    start = ctx.num(node, k, 'start', 0),
    end = ctx.num(node, k, 'end', 1),
    shift = ctx.num(node, k, 'shift', 0),
    strength = ctx.num(node, k, 'strength', 1);
  children.forEach((child, index) => {
    const point = sample(
      ctx,
      raw.path,
      start + ((end - start) * index) / Math.max(count - 1, 1) + shift,
    );
    if (!point) return;
    const current = ctx.world(child),
      desired = placed(ctx, child, point, !!raw.orient, false);
    ctx.setWorld(child, ctx.blend(current, desired, strength, child));
  });
}

type Lists = {
  listState(
    player: Player,
  ): { runs: { spec: { node: number }; items: { index: number; player: Player }[] }[] } | undefined;
  beforeDraw?: (player: Player) => void;
};
const hooked = new WeakSet<object>();

function placeRepeats(player: Player, lists: Lists): void {
  if (!player.model.doc.requires?.includes('pathfollow')) return;
  const ctx = activeRig?.context(player),
    frame = player.drawData,
    state = lists.listState(player);
  if (!ctx || !frame || !state) return;
  for (const run of state.runs) {
    const host = run.spec.node,
      constraints = player.model.nodes[host]!.raw.constraints ?? [];
    for (const [k, raw] of constraints.entries()) {
      if (raw.kind !== 'spreadAlongPath') continue;
      const count = run.items.length,
        start = ctx.num(host, k, 'start', 0),
        end = ctx.num(host, k, 'end', 1),
        shift = ctx.num(host, k, 'shift', 0),
        strength = ctx.num(host, k, 'strength', 1),
        hostWorld = ctx.world(host),
        inverseHost = invert(hostWorld);
      if (!inverseHost) continue;
      for (const [index, item] of run.items.entries()) {
        const point = sample(
          ctx,
          raw.path,
          start + ((end - start) * index) / Math.max(count - 1, 1) + shift,
        );
        if (!point) continue;
        const id = player.model.nodes[host]!.id + '/' + item.index,
          group = frame.tree.nodes.findIndex((entry) => entry?.id === id),
          data = frame.nodes[group];
        if (group < 0 || !data?.world) continue;
        const old = data.world,
          values = decompose(old);
        values[0] = point[0];
        values[1] = point[1];
        if (raw.orient) values[2] = point[2];
        const next = blend(old, compose(values), strength),
          oldInverse = invert(old),
          delta = oldInverse && mul(next, oldInverse);
        data.transform = mul(inverseHost, next);
        data.world = next;
        if (delta) {
          const visit = (at: number) => {
            for (const child of frame.tree.nodes[at]!.children) {
              const childData = frame.nodes[child];
              if (childData?.world) childData.world = mul(delta, childData.world);
              visit(child);
            }
          };
          visit(group);
        }
      }
    }
  }
}

export const pathfollow: Module = {
  name: 'pathfollow',
  after,
  entries: [...followEntries, ...listEntries],
  init(registry) {
    outlines = [...registry.values()].filter((module) => !!module.outline);
    activeRig = registry.get('rig') as typeof activeRig;
    registerConstraint({
      kind: 'alongPath',
      shape: {
        k: 'obj',
        p: {
          path: { k: 'str', feature: 'pathfollow' },
          at: number,
          orient: boolean,
          offset: boolean,
        },
        req: ['path'],
      },
      targets: (raw) => [raw.path],
      solve(ctx, node, raw, k) {
        const point = sample(ctx, raw.path, ctx.num(node, k, 'at', 0));
        if (point) return placed(ctx, node, point, !!raw.orient, !!raw.offset);
      },
    });
    registerConstraint({
      kind: 'spreadAlongPath',
      shape: {
        k: 'obj',
        p: {
          path: { k: 'str', feature: 'pathfollow' },
          start: number,
          end: number,
          shift: number,
          orient: boolean,
        },
        req: ['path'],
      },
      targets: (raw) => [raw.path],
      writes: (_raw, node, model) =>
        (model.nodes[node]?.type as string) === 'repeat' ? [] : (model.nodes[node]?.children ?? []),
      solve: spread,
    });
    const lists = registry.get('lists') as unknown as Lists | undefined;
    if (lists && !hooked.has(listModule)) {
      const previous = listModule.beforeDraw;
      listModule.beforeDraw = (player) => {
        previous?.(player);
        placeRepeats(player, lists);
      };
      hooked.add(listModule);
    }
    return pathfollow;
  },
  load(model, _raw, d) {
    if (!model.doc.requires?.includes('pathfollow')) return;
    for (const [node, n] of model.nodes.entries())
      for (const [k, raw] of (n.raw.constraints ?? []).entries()) {
        if (raw.kind !== 'alongPath' && raw.kind !== 'spreadAlongPath') continue;
        const target = model.ids.get(raw.path),
          type = target === undefined ? undefined : (model.nodes[target]!.type as string);
        if (target !== undefined && !['path', 'contour', 'circle', 'rect', 'arc'].includes(type!))
          d.err(
            'rig-path-target',
            nodePointer(model, node) + '/constraints/' + k + '/path',
            V && 'path constraint target is not a measurable shape',
            V && 'target a path, contour, circle, rect or arc node',
          );
      }
  },
};
