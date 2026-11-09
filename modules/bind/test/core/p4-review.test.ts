// Regression tests for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { evaluate, expression } from '../../core/expression.ts';

it('R3-04: colour equality compares components, not array identity', () => {
  const run = (s: string) => evaluate(expression(s, new Map()), new Map());
  expect(run('#fff == #ffffff')).toBe(true);
  expect(run('#fff != #ffffff')).toBe(false);
  expect(run('#ff0000 == #00ff00')).toBe(false);
  expect(run('#ff0000 != #00ff00')).toBe(true);
});
