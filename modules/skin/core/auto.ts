import type { Player } from '../../../packages/core/src/player.ts';
import { apply, IDENTITY } from '../../../packages/core/src/geom.ts';
import type { RigModule } from '../../rig/core/index.ts';
import type { Influence, SkinData } from './index.ts';

const cache = new WeakMap<Player, Map<string, Influence>>();

const distance = (p: [number, number], a: [number, number], b: [number, number]): number => {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    q = dx * dx + dy * dy,
    t = q ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

export function automatic(
  p: Player,
  node: number,
  key: string,
  point: [number, number],
  s: SkinData,
  rig: RigModule | undefined,
): Influence {
  let values = cache.get(p);
  if (!values) cache.set(p, (values = new Map()));
  const hit = values.get(key);
  if (hit) return hit;
  const ctx = rig?.context(p),
    w0 = ctx?.rest(node) ?? p.world(node),
    world = apply(w0, point[0], point[1]),
    nearest = s.bones
      .map((bone) => {
        const b = ctx?.rest(bone) ?? IDENTITY,
          a = apply(b, 0, 0),
          z = apply(b, p.model.nodes[bone]!.raw.length ?? 0, 0);
        return [bone, distance(world, a, z)] as [number, number];
      })
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2),
    weighted = nearest.map(([bone, d]) => [bone, 1 / (d + 0.001) ** 2] as [number, number]),
    sum = weighted.reduce((n, [, w]) => n + w, 0),
    result = weighted.map(([bone, w]) => [bone, w / sum] as [number, number]);
  values.set(key, result);
  return result;
}
