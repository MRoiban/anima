import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const permutations = <T>(xs: T[]): T[][] =>
  xs.length
    ? xs.flatMap((x, i) => permutations(xs.filter((_, j) => i !== j)).map((rest) => [x, ...rest]))
    : [[]];
it('composes identical schemas, CLI schemas, loaded corpus models and AniML in 12 arrival orders', () => {
  // Every permutation of components/paint/assets, before and after the remaining module set.
  // This includes surface-before-paint, wildcard-before-node, and component-before/after-bind.
  const subset = permutations(['components', 'paint', 'assets']);
  const orders = subset.flatMap((part) => [
    [...part, 'bind', 'composite', 'surface'],
    ['surface', 'composite', 'bind', ...part],
  ]);
  let baseline: string | undefined;
  for (const order of orders) {
    const output = execFileSync(
      process.execPath,
      [fileURLToPath(new URL('./helpers/module-order.ts', import.meta.url)), order.join(',')],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    );
    baseline ??= output;
    expect(output, order.join(',')).toBe(baseline);
  }
}, 30_000);
