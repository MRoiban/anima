import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { cases, measure, pendingCases, skippedCases } from './oracle.ts';

it.each(skippedCases)('documented oracle skip: $name', (c) => {
  expect(c.status).toBe('skip');
  expect(c.reason.length).toBeGreaterThan(40);
  expect(c.tests.length).toBeGreaterThan(0);
  for (const test of c.tests) expect(existsSync(new URL(`../${test}`, import.meta.url))).toBe(true);
  expect(cases.some((v) => v.name === c.name)).toBe(false);
  expect(pendingCases.some((v) => v.name === c.name)).toBe(false);
});

for (const c of cases)
  (c.finding ? it.fails : it)(
    `Rive oracle: ${c.name}${c.finding ? ` (known finding: ${c.finding})` : ''}`,
    async () => {
      const dir = mkdtempSync(join(tmpdir(), 'anima-oracle-'));
      try {
        const metrics = await measure(c, pathToFileURL(dir + '/'));
        for (const m of metrics) {
          expect(m.maxDiff, `${c.name} at ${m.time}s: max channel delta`).toBeLessThanOrEqual(
            c.values?.tolerance ?? c.maxDiff,
          );
          expect(
            m.overPercent,
            `${c.name} at ${m.time}s: pixels over ${c.threshold}`,
          ).toBeLessThanOrEqual(c.maxOverPercent);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

for (const c of pendingCases) it.todo(`Rive oracle: ${c.name} (pending: ${c.reason})`);

it('retains the exact uint data-dump disagreement (not an infrastructure failure)', async () => {
  const c = cases.find((c) => c.name === 'animation-keys-unsigned-integer')!;
  const dir = mkdtempSync(join(tmpdir(), 'anima-oracle-finding-'));
  try {
    const metrics = await measure(c, pathToFileURL(dir + '/'));
    expect(
      metrics.map((m) => [
        m.time,
        'actual' in m ? m.actual : null,
        'reference' in m ? m.reference : null,
        m.maxDiff,
        m.pass,
      ]),
    ).toEqual([
      [0, 0, 0, 0, true],
      [0.5, 0, 0, 0, true],
      [1.1, 4294967295, -1, 4294967296, false],
      [2, 4294967295, -1, 4294967296, false],
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
