import type { Module } from '../../../packages/core/src/modules.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
/** A module-owned tuple binding parser: scalar expressions stay with bind. */
export function tupleBindings(bind: Module): Module {
  const expression = bind.expression!;
  return {
    ...bind,
    expression(source, types, expected, p, d, read) {
      if (expected !== 'point') return expression(source, types, expected, p, d, read);
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
        d.err(
          'bind-type',
          p,
          V && 'point binding needs [x-expression, y-expression]',
          V && 'use two numeric expressions inside brackets',
        );
        return;
      }
      const x = expression(source.slice(1, comma), types, 'number', p, d, read),
        y = expression(source.slice(comma + 1, -1), types, 'number', p, d, read);
      if (x && y) return (scope) => [x(scope) as number, y(scope) as number];
    },
  };
}
