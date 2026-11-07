import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { drawFrame } from '../../../packages/core/src/draw.ts';
import { apply, mul, type Mat } from '../../../packages/core/src/geom.ts';
import { parsePath } from '../../../packages/core/src/path.ts';
import { fail } from '../../host/core/errors.ts';
import { after } from '../manifest.ts';
export interface Computed {
  readonly world: readonly number[];
  readonly bounds: Readonly<{ x: number; y: number; width: number; height: number }>;
  readonly opacity: number;
}
function computed(player: Player, id: string): Computed {
  const index = player.model.ids.get(id);
  if (index === undefined) fail('path', String(id), 'unknown computed node id');
  const frame = drawFrame(player);
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;
  const point = (x: number, y: number) => {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
  };
  const visit = (i: number, world: Mat): void => {
    const node = frame.nodes[i]!,
      entry = frame.tree.nodes[i]!;
    const g = node.geometry;
    if (g?.kind === 'circle') {
      const [x, y] = apply(world, g.cx!, g.cy!);
      const rx = g.r! * Math.hypot(world[0], world[2]),
        ry = g.r! * Math.hypot(world[1], world[3]);
      point(x - rx, y - ry);
      point(x + rx, y + ry);
    } else if (g?.d !== undefined) {
      for (const path of parsePath(g.d)) {
        let start: [number, number] = [0, 0],
          last = start;
        for (let j = 0; j < path.segs.length;) {
          const op = path.segs[j++]!;
          if (op === 3) {
            last = start;
            continue;
          }
          if (op !== 2) {
            last = apply(world, path.segs[j++]!, path.segs[j++]!);
            if (op === 0) start = last;
            point(...last);
            continue;
          }
          const a = last,
            b = apply(world, path.segs[j++]!, path.segs[j++]!),
            c = apply(world, path.segs[j++]!, path.segs[j++]!),
            d = apply(world, path.segs[j++]!, path.segs[j++]!);
          point(...d);
          for (const axis of [0, 1]) {
            const A = -a[axis]! + 3 * b[axis]! - 3 * c[axis]! + d[axis]!,
              B = 2 * (a[axis]! - 2 * b[axis]! + c[axis]!),
              C = b[axis]! - a[axis]!;
            const disc = B * B - 4 * A * C;
            const roots =
              Math.abs(A) < 1e-12
                ? B
                  ? [-C / B]
                  : []
                : disc < 0
                  ? []
                  : [(-B + Math.sqrt(disc)) / (2 * A), (-B - Math.sqrt(disc)) / (2 * A)];
            for (const t of roots)
              if (t > 0 && t < 1) {
                const v = (k: number) =>
                  (1 - t) ** 3 * a[k]! +
                  3 * (1 - t) ** 2 * t * b[k]! +
                  3 * (1 - t) * t * t * c[k]! +
                  t ** 3 * d[k]!;
                point(v(0), v(1));
              }
          }
          last = d;
        }
      }
    } else if (g?.width !== undefined && g.height !== undefined) {
      for (const x of [g.x ?? 0, (g.x ?? 0) + g.width])
        for (const y of [g.y ?? 0, (g.y ?? 0) + g.height]) point(...apply(world, x, y));
    }
    for (const child of entry.children) visit(child, mul(world, frame.nodes[child]!.transform));
  };
  const world = player.world(index!);
  visit(index!, world);
  let opacity = 1;
  for (let i = index!; i >= 0; i = player.model.nodes[i]!.parent)
    opacity *= player.num(i, 'opacity', 1);
  return Object.freeze({
    world: Object.freeze([...world]),
    bounds: Object.freeze(
      left === Infinity
        ? { x: world[4], y: world[5], width: 0, height: 0 }
        : { x: left, y: top, width: right - left, height: bottom - top },
    ),
    opacity,
  });
}
declare module '../../../packages/core/src/player.ts' {
  interface Player {
    computed(id: string): Computed;
  }
}
export const dataHost: Module = {
  name: 'datahost',
  after,
  entries: [],
  init(_registry, shared) {
    shared.Player.prototype.computed = function (id) {
      return computed(this, id);
    };
    return dataHost;
  },
  resolve(model, diag) {
    if (!model.doc.requires?.includes('datahost')) return;
    for (const [target, binding] of Object.entries(model.doc.bind ?? {})) {
      const source = typeof binding === 'string' ? binding : (binding as { value: string }).value;
      if (typeof source !== 'string') continue;
      const value = source.replace(
        /asset\(\s*("(?:[^"\\]|\\.)*")\s*\)|"(?:[^"\\]|\\.)*"/g,
        (token, name: string | undefined) => {
          if (!name) return token;
          let id: string;
          try {
            id = JSON.parse(name) as string;
          } catch {
            return token;
          }
          if (!Object.hasOwn(model.doc.assets ?? {}, id))
            diag.err(
              'unknown-asset',
              '/bind/' + target.replace(/~/g, '~0').replace(/\//g, '~1'),
              V && 'unknown binding asset',
              V && 'declare the asset in this document',
            );
          return name;
        },
      );
      if (typeof binding === 'string') model.doc.bind[target] = value;
      else (binding as { value: string }).value = value;
    }
  },
};
