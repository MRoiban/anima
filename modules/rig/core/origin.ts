import { apply, type Mat } from '../../../packages/core/src/geom.ts';
import { flatten } from '../../../packages/core/src/path.ts';
import type { RigContext } from './api.ts';
import { origin } from './constraints.ts';

function point(ctx: RigContext, node: number, uv: number[], frame: Mat): [number, number] {
  const n = ctx.model.nodes[node]!,
    raw = n.raw,
    points = n.geom
      ? flatten(n.geom).flatMap((s) => s.pts)
      : raw.center
        ? [
            raw.center[0] - raw.r,
            raw.center[1] - raw.r,
            raw.center[0] + raw.r,
            raw.center[1] + raw.r,
          ]
        : [raw.x0 ?? 0, raw.y0 ?? 0, (raw.x0 ?? 0) + (raw.w ?? 0), (raw.y0 ?? 0) + (raw.h ?? 0)];
  const at = (axis: number) => {
    const values = points.filter((_, k) => k % 2 === axis),
      lo = Math.min(...values);
    return lo + (Math.max(...values) - lo) * Number(uv[axis]);
  };
  return apply(frame, at(0), at(1));
}

export function installOrigin(target = origin): void {
  target.point = point;
}
