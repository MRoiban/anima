import type { Module } from '../../../packages/core/src/modules.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { Mat } from '../../../packages/core/src/geom.ts';
import { invert, localMatrix, mul } from '../../../packages/core/src/geom.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { nodePointer } from '../../components/core/node-pointer.ts';
import { compose, decompose, registerConstraint, type Constraint } from '../../rig/core/api.ts';
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
          bones: { k: 'num', min: 1, int: true },
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
        // A collapsed (zero-scale) bone has no direction to solve in: keep its pose.
        if (frames.some((f) => !invert(f))) return;
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
        } else {
          const parent = ctx.model.nodes[ids[0]!]!.parent,
            m = ctx.world(parent),
            side = (raw.bend === 'ccw' ? -1 : 1) * (m[0] * m[3] - m[1] * m[2] < 0 ? -1 : 1);
          const pair = (j: number) => {
            const a0 = points[j]!,
              c0 = points[j + 1]!,
              b0 = points[n]!,
              tx = target[0] - a0[0],
              ty = target[1] - a0[1],
              c = Math.hypot(tx, ty),
              rx = b0[0] - c0[0],
              ry = b0[1] - c0[1],
              a = Math.hypot(rx, ry),
              b = length[j]!;
            if (!c || !a) return;
            const far = c >= a + b,
              along = far ? b : (b * b - a * a + c * c) / (2 * c),
              height = far ? 0 : Math.sqrt(Math.max(0, b * b - along * along)),
              next: [number, number] = [
                a0[0] + (tx * along - ty * height * side) / c,
                a0[1] + (ty * along + tx * height * side) / c,
              ],
              end: [number, number] = far
                ? [a0[0] + (tx / c) * (a + b), a0[1] + (ty / c) * (a + b)]
                : target,
              angle = Math.atan2(end[1] - next[1], end[0] - next[0]) - Math.atan2(ry, rx),
              co = Math.cos(angle),
              si = Math.sin(angle);
            for (let q = j + 2; q <= n; q++) {
              const x = points[q]![0] - c0[0],
                y = points[q]![1] - c0[1];
              points[q] = [next[0] + co * x - si * y, next[1] + si * x + co * y];
            }
            points[j + 1] = next;
          };
          for (let j = 0; j < n - 1; j++) pair(j);
        }
        const strength = ctx.num(node, k, 'strength', 1);
        const locals = ids.map((i, j) => {
            if (j) return mul(invert(frames[j - 1]!)!, frames[j]!);
            const p = ctx.model.nodes[i]!.parent,
              linked =
                (ctx.model.nodes[p]?.type as string) === 'bone' && !ctx.model.nodes[i]!.raw.root,
              scale = ctx.player.num(i, 'scale', 1);
            return localMatrix(
              linked ? ctx.player.num(p, 'length', 0) : ctx.player.num(i, 'x', 0),
              linked ? 0 : ctx.player.num(i, 'y', 0),
              0,
              0,
              ctx.player.num(i, 'rotate', 0),
              scale * ctx.player.num(i, 'scaleX', 1),
              scale * ctx.player.num(i, 'scaleY', 1),
            );
          }),
          rest = invert(locals[0]!);
        // The first bone's authored local can be singular even when a prior constraint repaired its
        // world frame (zero animated scale): there is no chain base to solve from, so keep the pose.
        if (!rest) return;
        const base = mul(frames[0]!, rest),
          solved: Mat[] = [];
        for (let j = 0; j < n; j++) {
          const parent = j ? solved[j - 1]! : base,
            back = invert(parent)!,
            dx = points[j + 1]![0] - points[j]![0],
            dy = points[j + 1]![1] - points[j]![1],
            parts = decompose(locals[j]!);
          parts[2] = Math.atan2(back[1] * dx + back[3] * dy, back[0] * dx + back[2] * dy);
          solved[j] = mul(parent, compose(parts));
        }
        let parent = base;
        for (let j = 0; j < n; j++) {
          parent = mul(
            parent,
            ctx.blend(locals[j]!, mul(invert(j ? solved[j - 1]! : base)!, solved[j]!), strength),
          );
          ctx.setWorld(ids[j]!, parent);
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
