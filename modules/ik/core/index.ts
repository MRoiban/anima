import type { Module } from '../../../packages/core/src/modules.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { Mat } from '../../../packages/core/src/geom.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { nodePointer } from '../../components/core/node-pointer.ts';
import { registerConstraint, type Constraint } from '../../rig/core/api.ts';
import { after } from '../manifest.ts';

function chain(model: Model, node: number, count: number): number[] {
  const out: number[] = [];
  while (count-- > 0 && (model.nodes[node]?.type as string) === 'bone') {
    out.unshift(node);
    if (model.nodes[node]!.raw.root) break;
    node = model.nodes[node]!.parent;
  }
  return out;
}

export const ik: Module = {
  name: 'ik',
  after,
  entries: [],
  init() {
    registerConstraint({
      kind: 'ik',
      shape: {
        k: 'obj',
        p: {
          target: { k: 'str', feature: 'ik' },
          bones: { k: 'num', min: 1 },
          bend: { k: 'str', of: ['cw', 'ccw'] },
        },
        req: ['target'],
      },
      targets: (r) => [r.target],
      writes: (r, i, m) => chain(m, i, r.bones ?? 1).filter((j) => j !== i),
      solve(ctx, node, raw: Constraint, k) {
        const ids = chain(ctx.model, node, raw.bones ?? 1),
          n = ids.length;
        if (!n) return;
        const frames = ids.map((i) => ctx.world(i)),
          points = ids.map((i) => ctx.position(i));
        const last = frames[n - 1]!,
          length = ids.map(
            (i, j) => ctx.player.num(i, 'length', 0) * Math.hypot(frames[j]![0], frames[j]![1]),
          );
        points.push([
          last[4] + last[0] * ctx.player.num(node, 'length', 0),
          last[5] + last[1] * ctx.player.num(node, 'length', 0),
        ]);
        const start = [...points[0]!] as [number, number],
          target = ctx.position(ctx.model.ids.get(raw.target)!);
        const dx = target[0] - start[0],
          dy = target[1] - start[1],
          dist = Math.hypot(dx, dy);
        if (!dist) return;
        const total = length.reduce((a, b) => a + b, 0);
        if (n === 1 || dist >= total) {
          for (let j = 0; j < n; j++)
            points[j + 1] = [
              points[j]![0] + (dx / dist) * length[j]!,
              points[j]![1] + (dy / dist) * length[j]!,
            ];
        } else if (n === 2) {
          const a = length[0]!,
            b = length[1]!,
            along = (a * a - b * b + dist * dist) / (2 * dist),
            height = Math.sqrt(Math.max(0, a * a - along * along));
          const parent = ctx.model.nodes[ids[0]!]!.parent,
            m = ctx.world(parent),
            side = (raw.bend === 'ccw' ? -1 : 1) * (m[0] * m[3] - m[1] * m[2] < 0 ? -1 : 1);
          points[1] = [
            start[0] + (dx * along - dy * height * side) / dist,
            start[1] + (dy * along + dx * height * side) / dist,
          ];
          points[2] = target;
        } else {
          for (let iteration = 0; iteration < 64; iteration++) {
            points[n] = [...target];
            for (let j = n - 1; j >= 0; j--) {
              const x = points[j]![0] - points[j + 1]![0],
                y = points[j]![1] - points[j + 1]![1],
                d = Math.hypot(x, y) || 1;
              points[j] = [
                points[j + 1]![0] + (x / d) * length[j]!,
                points[j + 1]![1] + (y / d) * length[j]!,
              ];
            }
            points[0] = [...start];
            for (let j = 0; j < n; j++) {
              const x = points[j + 1]![0] - points[j]![0],
                y = points[j + 1]![1] - points[j]![1],
                d = Math.hypot(x, y) || 1;
              points[j + 1] = [
                points[j]![0] + (x / d) * length[j]!,
                points[j]![1] + (y / d) * length[j]!,
              ];
            }
          }
        }
        const strength = ctx.num(node, k, 'strength', 1);
        for (let j = 0; j < n; j++) {
          const old = frames[j]!,
            angle =
              Math.atan2(points[j + 1]![1] - points[j]![1], points[j + 1]![0] - points[j]![0]) -
              Math.atan2(old[1], old[0]),
            c = Math.cos(angle),
            s = Math.sin(angle);
          const desired: Mat = [
            c * old[0] - s * old[1],
            s * old[0] + c * old[1],
            c * old[2] - s * old[3],
            s * old[2] + c * old[3],
            points[j]![0],
            points[j]![1],
          ];
          ctx.setWorld(ids[j]!, ctx.blend(old, desired, strength, ids[j]));
        }
      },
    });
    return ik;
  },
  load(model, _raw, d) {
    if (!model.doc.requires?.includes('ik')) return;
    for (const [i, n] of model.nodes.entries())
      for (const [k, r] of (n.raw.constraints ?? []).entries()) {
        if (r?.kind !== 'ik') continue;
        const at = nodePointer(model, i) + '/constraints/' + k;
        if ((n.type as string) !== 'bone')
          d.err(
            'rig-ik-host',
            at,
            V && 'ik constraints must be hosted by a bone',
            V && 'move the ik constraint onto the chain tip bone',
          );
        else if (chain(model, i, r.bones ?? 1).length < (r.bones ?? 1))
          d.err(
            'rig-ik-chain',
            at + '/bones',
            V && 'ik bones exceeds the available bone chain',
            V && 'reduce bones or add parent bones to the chain',
          );
      }
  },
};
