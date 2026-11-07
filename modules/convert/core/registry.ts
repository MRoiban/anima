import type { ObjShape, Shape } from '../../../packages/core/src/registry.ts';
const n: Shape = { k: 'num' },
  s: Shape = { k: 'str' },
  b: Shape = { k: 'bool' };
export const options: Record<string, Shape> = {
  type: s,
  expression: s,
  random: { k: 'str', of: ['always', 'once', 'on-change'] },
  from: { k: 'tup', of: [n, n], min: 2 },
  to: { k: 'tup', of: [n, n], min: 2 },
  clamp: b,
  modulo: b,
  reverse: b,
  decimals: { k: 'num', min: 0, max: 100, int: true },
  grouping: b,
  pattern: s,
  format: { k: 'str', of: ['hex', 'hexa', 'rgb', 'rgba'] },
  length: { k: 'num', min: 0, max: 10000, int: true },
  fill: s,
  side: { k: 'str', of: ['start', 'end'] },
  mode: s,
  text: s,
  args: { k: 'any' },
  open: s,
  close: s,
  values: { k: 'arr', of: s },
  item: { k: 'any' },
  ease: s,
  duration: { k: 'num', min: 0 },
  operation: s,
  operand: { k: 'alt', of: [n, s] },
};
export const definition: ObjShape = { k: 'obj', p: options, req: ['type'] };
export const group: ObjShape = {
  k: 'obj',
  p: { chain: { k: 'arr', of: s, min: 1 } },
  req: ['chain'],
};
