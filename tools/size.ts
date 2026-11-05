// Size budgets: core+web ≤25 KB; markup ≤8 KB, paint ≤5 KB, composite ≤4 KB incremental.
// Libraries ≤2 KB incremental over web+markup.
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
console.log(`core+web draw-layer delta: ${gz - 16697} B (b7b6e92 baseline 16697 B; target ≤0 B)`);

const composite = await bundle(
  new URL('../packages/web/src/composite.ts', import.meta.url).pathname,
);
const compositeDelta = gzipSync(composite, { level: 9 }).length - gz;
console.log(`composite: ${compositeDelta} B min+gzip incremental (budget 4096 B)`);
if (compositeDelta > 4096) process.exitCode = 1;

const libraries = await bundle(
  new URL('../packages/web/src/markup-libraries.ts', import.meta.url).pathname,
);
const librariesDelta =
  gzipSync(libraries, { level: 9 }).length - gzipSync(markup, { level: 9 }).length;
console.log(
  `markup-libraries: ${librariesDelta} B min+gzip incremental over web+markup (budget 2048 B)`,
);
if (librariesDelta > 2048) process.exitCode = 1;
