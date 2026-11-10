import { IDENTITY, mul, clamp, type Mat } from '../../../packages/core/src/geom.ts';
import type { Shape, ObjShape } from '../../../packages/core/src/registry.ts';
import { compose, decompose, registerConstraint, type RigContext } from './api.ts';
import { bone, inverse, pivot } from './solve.ts';
export const number = (min?: number, max?: number): Shape => ({ k: 'num', min, max });
const string = (of?: string[]): Shape => ({ k: 'str', of });
export const origin: {
  point?: (ctx: RigContext, node: number, uv: number[], frame: Mat) => [number, number];
} = {};
export const space: Shape = string(['world', 'local']);
const spaces = {
  fromSpace: space,
  toSpace: space,
  limitSpace: space,
};
export function parentFrame(ctx: RigContext, i: number, rest = false): Mat {
  const p = ctx.model.nodes[i]!.parent;
  if (p < 0) return IDENTITY;
  let m = rest ? ctx.rest(p) : ctx.world(p);
  if (bone(ctx.model, p) && !(bone(ctx.model, i) && !ctx.model.nodes[i]!.raw.root)) {
    let a = p;
    while (bone(ctx.model, a)) a = ctx.model.nodes[a]!.parent;
    m = mul(mul(m, inverse(ctx.rest(p))), ctx.rest(a));
  }
  return m;
}
const inSpace = (ctx: RigContext, i: number, m: Mat, s: unknown, rest = false) =>
  s === 'local' ? mul(inverse(parentFrame(ctx, i, rest)), m) : m;
const outSpace = (ctx: RigContext, i: number, m: Mat, s: unknown) =>
  s === 'local' ? mul(parentFrame(ctx, i), m) : m;
export function registerCopies(): void {
  for (const [kind, axis] of [
    ['copyPosition', 0],
    ['copyRotation', 2],
    ['copyScale', 3],
    ['copyTransform', -1],
  ] as const) {
    const vector = axis === 0 || axis === 3;
    const shape: ObjShape = {
      k: 'obj',
      p: {
        from: string(),
        ...spaces,
        ...(axis === -1
          ? { origin: { k: 'tup', of: [number(), number()], min: 2 } as Shape }
          : {
              offset: { k: 'bool' } as Shape,
              ...(vector
                ? {
                    factorX: number(),
                    factorY: number(),
                    copyX: { k: 'bool' } as Shape,
                    copyY: { k: 'bool' } as Shape,
                    minX: number(),
                    maxX: number(),
                    minY: number(),
                    maxY: number(),
                  }
                : { factor: number(), min: number(), max: number() }),
            }),
      },
      req: axis === -1 ? ['from'] : [],
    };
    registerConstraint({
      kind,
      shape,
      targets: (r) => (r.from ? [r.from] : []),
      solve(ctx, i, r, k) {
        const j = ctx.model.ids.get(r.from),
          pv = pivot(ctx.model, i),
          target =
            j === undefined
              ? r.fromSpace === 'local'
                ? IDENTITY
                : parentFrame(ctx, i)
              : inSpace(ctx, j, ctx.world(j), r.fromSpace),
          source = decompose(
            target,
            j === undefined
              ? r.fromSpace === 'local'
                ? undefined
                : pivot(ctx.model, ctx.model.nodes[i]!.parent)
              : pivot(ctx.model, j),
          ),
          current = decompose(inSpace(ctx, i, ctx.world(i), r.toSpace), pv),
          rest = decompose(inSpace(ctx, i, ctx.rest(i), r.toSpace, true), pv);
        if (axis === -1) {
          current.splice(0, 6, ...source);
          const value = ctx.player.prop(i, `constraints.${k}.origin`) ?? r.origin;
          if (j !== undefined && Array.isArray(value) && origin.point)
            [current[0], current[1]] = origin.point(ctx, j, value, target);
        } else
          for (let a = 0; a < (vector ? 2 : 1); a++) {
            const suffix = vector ? 'XY'[a]! : '',
              index = axis + a;
            if (r['copy' + suffix] === false) continue;
            current[index] =
              source[index]! *
                ctx.num(i, k, 'factor' + suffix, 1) *
                (axis === 3 && r.offset ? rest[index]! : 1) +
              (axis !== 3 && r.offset ? rest[index]! : 0);
          }
        let desired = outSpace(ctx, i, compose(current, pv), r.toSpace);
        if (axis !== -1) {
          const limited =
            (r.limitSpace ?? r.toSpace ?? 'world') === (r.toSpace ?? 'world')
              ? current
              : decompose(inSpace(ctx, i, desired, r.limitSpace), pv);
          for (let a = 0; a < (vector ? 2 : 1); a++) {
            const suffix = vector ? 'XY'[a]! : '',
              index = axis + a,
              units = axis === 2 ? 180 / Math.PI : 1;
            limited[index] =
              clamp(
                limited[index]! * units,
                ctx.num(i, k, 'min' + suffix, -Infinity),
                ctx.num(i, k, 'max' + suffix, Infinity),
              ) / units;
          }
          desired = outSpace(ctx, i, compose(limited, pv), r.limitSpace ?? r.toSpace);
        }
        return desired;
      },
    });
  }
}
