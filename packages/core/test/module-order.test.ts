import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { discover } from '../../../tools/modules.ts';

const permutations = <T>(xs: T[]): T[][] =>
  xs.length
    ? xs.flatMap((x, i) => permutations(xs.filter((_, j) => i !== j)).map((rest) => [x, ...rest]))
    : [[]];
it('composes identical schemas, CLI schemas, loaded corpus models and AniML in 12 arrival orders', async () => {
  // Every permutation of components/paint/assets, before and after the remaining module set.
  // This includes surface-before-paint, wildcard-before-node, and component-before/after-bind.
  const subset = permutations(['components', 'paint', 'assets']);
  const remaining = (await discover(fileURLToPath(new URL('../../../', import.meta.url))))
    .filter((m) => m.core && !['components', 'paint', 'assets'].includes(m.name))
    .map((m) => m.name);
  const orders = subset.flatMap((part) => [
    [...part, ...remaining],
    [...remaining].reverse().concat(part),
  ]);
  // Each order runs in its own fresh process; they are independent, so run two at a time (the
  // corpus grows every phase and twelve sequential processes reached the limit). Every output must
  // still equal the first order's.
  const run = promisify(execFile);
  const helper = fileURLToPath(new URL('./helpers/module-order.ts', import.meta.url));
  const outputs: string[] = new Array(orders.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: 2 }, async () => {
      while (next < orders.length) {
        const i = next++;
        outputs[i] = (
          await run(process.execPath, [helper, orders[i]!.join(',')], {
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
          })
        ).stdout;
      }
    }),
  );
  for (const [i, order] of orders.entries()) expect(outputs[i], order.join(',')).toBe(outputs[0]);
}, 30_000);
