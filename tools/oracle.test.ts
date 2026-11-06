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
  it(`Rive oracle: ${c.name}`, async () => {
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
  });

for (const c of pendingCases) it.todo(`Rive oracle: ${c.name} (pending: ${c.reason})`);
