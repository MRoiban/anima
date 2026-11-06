// Canvas-only probes use the same repo comparator, dimensions, inputs and fixed thresholds.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { it, expect } from 'vitest';
import { chromium, firefox } from 'playwright-core';
import { renderCanvas } from '../../../paint/oracle-canvas.ts';
import { compare, type OracleCase } from '../../../../tools/oracle.ts';
const cases: OracleCase[] = JSON.parse(
  readFileSync('modules/paint/probes/canvas-cases.json', 'utf8'),
);
for (const engine of [chromium.name(), firefox.name()] as ('chromium' | 'firefox')[])
  for (const c of cases)
    it(`${engine} native Canvas oracle: ${c.name}`, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'anima-native-canvas-'));
      try {
        const base = `tests/oracle/${c.name}/`;
        const target = pathToFileURL(join(dir, '0.png'));
        await renderCanvas(JSON.parse(readFileSync(base + 'case.ani', 'utf8')), '', target, engine);
        const { diff, ...m } = compare(
          readFileSync(target),
          readFileSync(base + 'rive/frames/0.png'),
          c.threshold,
        );
        void diff;
        console.log(c.name, m);
        if (c.name.endsWith('gradient-angular')) {
          // Proven periodic texture seam in the native renderer; retained as a finding, never a pass.
          expect(m).toEqual({ maxDiff: 50, over: 136, overPercent: (100 * 136) / 57600 });
          expect(m.maxDiff <= c.maxDiff && m.overPercent <= c.maxOverPercent).toBe(false);
        } else {
          expect(m.maxDiff).toBeLessThanOrEqual(c.maxDiff);
          expect(m.overPercent).toBeLessThanOrEqual(c.maxOverPercent);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }, 30000);
