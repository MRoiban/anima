import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, it } from 'vitest';
import { cases, measure, pendingCases } from './oracle.ts';

it.each(cases)('Rive oracle: $name', async (c) => {
  const dir = mkdtempSync(join(tmpdir(), 'anima-oracle-'));
  try {
    const metrics = await measure(c, pathToFileURL(dir + '/'));
    for (const m of metrics) {
      expect(m.maxDiff, `${c.name} at ${m.time}s: max channel delta`).toBeLessThanOrEqual(
        c.maxDiff,
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
