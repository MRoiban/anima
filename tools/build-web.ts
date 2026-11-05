// Builds the browser bundle (packages/web/dist/anima-icon.js) and the standalone demo
// (examples/web/index.html: bundle and bell.ani inlined, so the page makes no requests).
//   node tools/build-web.ts [--check]   (--check: fail if the committed demo is stale)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { bundle } from './browser-build.ts';

const root = new URL('../', import.meta.url);
const js = await bundle(new URL('packages/web/src/index.ts', root).pathname);
mkdirSync(new URL('packages/web/dist/', root), { recursive: true });
writeFileSync(new URL('packages/web/dist/anima-icon.js', root), js);

const bell = readFileSync(new URL('examples/bell.ani', root), 'utf8');
const page = readFileSync(new URL('examples/web/template.html', root), 'utf8')
  .replace('<!-- BELL -->', () => bell.trim().replace(/<\//g, '<\\/'))
  .replace('/* RUNTIME */', () => js.trim().replace(/<\/script/gi, '<\\/script'));
const out = new URL('examples/web/index.html', root);
if (process.argv.includes('--check')) {
  if (readFileSync(out, 'utf8') !== page) {
    console.error('examples/web/index.html is stale: run node tools/build-web.ts');
    process.exit(1);
  }
} else writeFileSync(out, page);
console.log(`anima-icon.js ${js.length} B; examples/web/index.html ${page.length} B`);
