import { registerConstraint, type ConstraintKind } from './api.ts';
import type { Mat } from '../../../packages/core/src/geom.ts';
export function registerDistance(register: (c: ConstraintKind) => void = registerConstraint): void {
  register({
    kind: 'keepDistance',
    shape: {
      k: 'obj',
      p: {
        to: { k: 'str' },
        distance: { k: 'num', min: 0 },
        mode: { k: 'str', of: ['within', 'beyond', 'exact'] },
      },
      req: ['to', 'distance'],
    },
    targets: (r) => [r.to],
    solve(ctx, i, r, k) {
      const m = [...ctx.world(i)] as Mat,
        a = ctx.position(i),
        b = ctx.position(ctx.model.ids.get(r.to)!),
        x = a[0] - b[0],
        y = a[1] - b[1],
        length = Math.hypot(x, y),
        d = ctx.num(i, k, 'distance', 0);
      if (r.mode === 'exact' || (r.mode === 'beyond' ? length < d : length > d)) {
        m[4] += (length ? x / length : 1) * d - x;
        m[5] += (length ? y / length : 0) * d - y;
      }
      return m;
    },
  });
}
