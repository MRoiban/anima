import type { Model } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { IDENTITY, invert, localMatrix, mul, type Mat } from '../../../packages/core/src/geom.ts';
import {
  blend,
  constraintKinds,
  position,
  solvePasses,
  type Constraint,
  type RigContext,
} from './api.ts';

export const bone = (m: Model, i: number) => (m.nodes[i]?.type as string) === 'bone';
export const pivot = (m: Model, i: number): number[] =>
  bone(m, i) ? [0, 0] : (m.nodes[i]?.raw.pivot ?? [0, 0]);
export const inverse = (m: Mat): Mat => invert(m) ?? [...IDENTITY];
export const contexts = new WeakMap<Player, RigContext>();
export function install(model: Model, order: number[]): void {
  const rest: Mat[] = [],
    restDraw: Mat[] = [];
  const frame = (i: number, read: (i: number, key: string, def: number) => number): Mat => {
    const n = model.nodes[i]!,
      chain = bone(model, i) && bone(model, n.parent) && !n.raw.root,
      s = read(i, 'scale', 1);
    return localMatrix(
      chain ? read(n.parent, 'length', 0) : read(i, 'x', 0),
      chain ? 0 : read(i, 'y', 0),
      ...(pivot(model, i) as [number, number]),
      read(i, 'rotate', 0),
      s * read(i, 'scaleX', 1),
      s * read(i, 'scaleY', 1),
    );
  };
  for (const [i, n] of model.nodes.entries()) {
    const parent = restDraw[n.parent] ?? IDENTITY;
    rest[i] = mul(
      bone(model, i) && bone(model, n.parent) && !n.raw.root ? rest[n.parent]! : parent,
      frame(i, (j, key, def) => model.nodes[j]!.raw[key] ?? def),
    );
    restDraw[i] = bone(model, i) ? parent : rest[i]!;
  }
  const previousInit = model.nesting,
    previousStep = model.afterStep;
  model.nesting = (p) => {
    const nested = previousInit?.(p),
      local = p.local.bind(p),
      worlds: Mat[] = [],
      drawn: Mat[] = [],
      locals: Mat[] = [],
      overrides = new Map<number, Mat>();
    let solving = -1;
    const ctx: RigContext = {
      player: p,
      model,
      world: (i) => worlds[i] ?? IDENTITY,
      rest: (i) => rest[i] ?? IDENTITY,
      position: (i, matrix = worlds[i] ?? IDENTITY) => position(matrix, pivot(model, i)),
      setWorld(i, matrix) {
        if (solving >= 0 && i !== solving) overrides.set(i, matrix);
        worlds[i] = matrix;
        drawn[i] = bone(model, i) ? mul(mul(matrix, inverse(rest[i]!)), restDraw[i]!) : matrix;
        const m = mul(inverse(drawn[model.nodes[i]!.parent] ?? IDENTITY), drawn[i]!);
        {
          const old = locals[i];
          if (!old || m.some((v, k) => v !== old[k])) {
            locals[i] = m;
            // Descendants' cached geometry/world consumers must see upstream motion too.
            const dirty = (j: number) => {
              p.drawVersions[j] = ++p.drawRevision;
              model.nodes[j]!.children.forEach(dirty);
            };
            dirty(i);
          }
        }
      },
      num: (i, k, key, def) => p.num(i, `constraints.${k}.${key}`, def),
      blend: (a, b, t, i) => blend(a, b, t, i === undefined ? undefined : pivot(model, i)),
    };
    contexts.set(p, ctx);
    p.local = (i) => locals[i] ?? local(i);
    let signature = '';
    const solve = () => {
      const next = JSON.stringify([
        model.nodes.map((_, i) => local(i)),
        p.addrs.map((a) => p.value(a)),
      ]);
      let run = next !== signature;
      signature = next;
      const pass = () => {
        overrides.clear();
        for (const i of order) {
          const n = model.nodes[i]!,
            parent = drawn[n.parent] ?? IDENTITY;
          solving = i;
          ctx.setWorld(
            i,
            overrides.get(i) ??
              (bone(model, i)
                ? mul(
                    bone(model, n.parent) && !n.raw.root ? worlds[n.parent]! : parent,
                    frame(i, p.num.bind(p)),
                  )
                : mul(parent, local(i))),
          );
          (n.raw.constraints ?? []).forEach((raw: Constraint, k: number) => {
            const t = ctx.num(i, k, 'strength', 1);
            if (!t) return;
            const desired = constraintKinds.get(raw.kind)?.solve(ctx, i, raw, k);
            if (desired) ctx.setWorld(i, ctx.blend(worlds[i]!, desired, t, i));
          });
        }
        solving = -1;
      };
      solvePasses(ctx, () => {
        if (run) pass();
        run = true;
      });
    };
    (ctx as RigContext & { solve: () => void }).solve = solve;
    solve();
    return nested;
  };
  model.afterStep = (p) => {
    previousStep?.(p);
    (contexts.get(p) as RigContext & { solve: () => void }).solve();
  };
}
