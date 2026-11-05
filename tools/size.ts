// Size budget (ARCHITECTURE §web): core + web, minified and gzipped, must stay under 12 KB.
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';

const BUDGET = 12 * 1024;

const result = await build({
  entryPoints: [new URL('../packages/web/src/index.ts', import.meta.url).pathname],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  write: false,
  legalComments: 'none',
});
const code = result.outputFiles[0]!.contents;
const gz = gzipSync(code, { level: 9 }).length;
const line = `core+web: ${code.length} B min, ${gz} B min+gzip (budget ${BUDGET} B)`;
if (gz > BUDGET) {
  console.error(`${line} — over budget`);
  process.exit(1);
}
console.log(line);
