// Size budget (ARCHITECTURE §web): core + web, minified and gzipped, must stay under 12 KB.
import { gzipSync } from 'node:zlib';
import { bundle } from './browser-build.ts';

const BUDGET = 12 * 1024;

const code = await bundle(new URL('../packages/web/src/index.ts', import.meta.url).pathname);
const gz = gzipSync(code, { level: 9 }).length;
const line = `core+web: ${code.length} B min, ${gz} B min+gzip (budget ${BUDGET} B)`;
if (gz > BUDGET) {
  console.error(`${line} — over budget`);
  process.exit(1);
}
console.log(line);
