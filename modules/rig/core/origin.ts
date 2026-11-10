import { apply, type Mat } from '../../../packages/core/src/geom.ts';
import { flatten } from '../../../packages/core/src/path.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
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

function tupleBindings(bind: Module): Module {
  const expression = bind.expression!;
  return {
    ...bind,
    expression(source, types, expected, pointer, diag, read) {
      if (expected !== 'point') return expression(source, types, expected, pointer, diag, read);
      source = source.trim();
      let depth = 0,
        comma = -1;
      for (let k = 1; k < source.length - 1; k++) {
        if (source[k] === '(') depth++;
        if (source[k] === ')') depth--;
        if (source[k] === ',' && depth === 0) {
          comma = k;
          break;
        }
      }
      if (source[0] !== '[' || !source.endsWith(']') || comma < 0) {
        diag.err(
          'bind-type',
          pointer,
          V && 'origin binding needs [u-expression, v-expression]',
          V && 'use two numeric expressions inside brackets',
        );
        return;
      }
      const u = expression(source.slice(1, comma), types, 'number', pointer, diag, read),
        v = expression(source.slice(comma + 1, -1), types, 'number', pointer, diag, read);
      if (u && v) return (scope) => [u(scope) as number, v(scope) as number];
    },
  };
}

export function installOrigin(target = origin, bind?: Module): void {
  target.point = point;
  if (bind) Object.assign(bind, tupleBindings(bind));
}
