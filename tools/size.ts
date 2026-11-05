// Size budgets: core + web ≤25 KB, optional AniML support ≤6 KB incremental min+gzip.
import { gzipSync } from 'node:zlib';
import { bundle } from './browser-build.ts';

const BUDGET = 25 * 1024;
// Raised from 6 KB at P4a (owner-set estimates; see docs/LOG.md P4a): every module adds markup forms.
const MARKUP_BUDGET = 8 * 1024;

const code = await bundle(new URL('../packages/web/src/index.ts', import.meta.url).pathname);
const gz = gzipSync(code, { level: 9 }).length;
const line = `core+web: ${code.length} B min, ${gz} B min+gzip (budget ${BUDGET} B)`;
if (gz > BUDGET) {
  console.error(`${line} — over budget`);
  process.exitCode = 1;
} else console.log(line);

const markup = await bundle(new URL('../packages/web/src/markup.ts', import.meta.url).pathname);
const delta = gzipSync(markup, { level: 9 }).length - gz;
const markupLine = `markup: ${delta} B min+gzip incremental (budget ${MARKUP_BUDGET} B)`;
if (delta > MARKUP_BUDGET) {
  console.error(`${markupLine} — over budget`);
  process.exitCode = 1;
} else console.log(markupLine);

const paint = await bundle(new URL('../packages/web/src/paint.ts', import.meta.url).pathname);
const paintDelta = gzipSync(paint, { level: 9 }).length - gz;
console.log(`paint: ${paintDelta} B min+gzip incremental (budget 5120 B)`);
if (paintDelta > 5120) process.exitCode = 1;
console.log(`core+web hook delta: ${gz - 15880} B (e5170d4 baseline 15880 B; target 600 B)`);
