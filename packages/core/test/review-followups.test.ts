// Review follow-ups after the per-phase Rottweiler reviews (2026-11-09).
import { expect, it } from 'vitest';
import '../src/all.ts';
import { load } from '../src/index.ts';

const nest = (levels: number): unknown => {
  let v: unknown = 1;
  for (let i = 0; i < levels; i++) v = { a: v };
  return v;
};
const doc = (meta: unknown) => ({
  anima: '0.1',
  name: 'depth',
  grid: 20,
  meta: { x: meta },
  nodes: [{ id: 'r', type: 'rect', x0: 0, y0: 0, w: 2, h: 2, fill: { color: '#000' } }],
});

// P1 R3-04/R4-08 root cause: free-form JSON was not depth-checked, so pathological nesting reached
// formatters and recursive walkers and overflowed the stack.
it('refuses free-form JSON nested beyond the limit without recursion, and accepts ordinary nesting', () => {
  expect(load(doc(nest(5000))).diagnostics.map((d) => [d.code, d.pointer])).toEqual([
    ['limit-exceeded', '/meta'],
  ]);
  expect(load(doc(nest(20))).diagnostics).toEqual([]);
});

it('walks JS-built cycles and shared values linearly (no exponential blow-up)', () => {
  const twice: Record<string, unknown> = {};
  twice.a = twice;
  twice.b = twice;
  const start = Date.now();
  expect(() => load(doc(twice))).not.toThrow();
  expect(Date.now() - start).toBeLessThan(2000);
});
