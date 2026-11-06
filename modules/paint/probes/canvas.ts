// Module-owned native oracle capture; shares tools/oracle.ts's original raw comparator.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderCanvas } from '../oracle-canvas.ts';
import { compare, type OracleCase } from '../../../tools/oracle.ts';
const cases: OracleCase[] = JSON.parse(
  readFileSync('modules/paint/probes/canvas-cases.json', 'utf8'),
);
const metrics = [];
for (const engine of ['chromium', 'firefox'] as const)
  for (const c of cases) {
    const base = `tests/oracle/${c.name}/`;
    const out = engine === 'chromium' ? `${base}anima/` : `/tmp/anima-paint-${engine}-${c.name}/`;
    mkdirSync(out, { recursive: true });
    const file = pathToFileURL(resolve(out, '0.png'));
    await renderCanvas(JSON.parse(readFileSync(base + 'case.ani', 'utf8')), '', file, engine);
    const { diff, ...m } = compare(
      readFileSync(file),
      readFileSync(base + 'rive/frames/0.png'),
      c.threshold,
    );
    if (engine === 'chromium') writeFileSync(out + '0-diff.png', diff);
    metrics.push({
      engine,
      name: c.name,
      ...m,
      pass: m.maxDiff <= c.maxDiff && m.overPercent <= c.maxOverPercent,
    });
  }
writeFileSync('modules/paint/probes/canvas-metrics.json', JSON.stringify(metrics, null, 2) + '\n');
console.log(metrics);
