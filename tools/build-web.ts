// Builds the base and optional markup browser bundles (packages/web/dist/) and the standalone
// demo (examples/web/index.html: base bundle and bell.ani inlined, so it makes no requests).
//   node tools/build-web.ts [--check]   (--check: fail if the demo or existing bundles are stale)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { bundle } from './browser-build.ts';

const root = new URL('../', import.meta.url);
const js = await bundle(new URL('packages/web/src/index.ts', root).pathname);
const markup = await bundle(new URL('packages/web/src/markup.ts', root).pathname);
const libraries = await bundle(new URL('packages/web/src/markup-libraries.ts', root).pathname);
const paint = await bundle(new URL('packages/web/src/paint.ts', root).pathname);
const composite = await bundle(new URL('packages/web/src/composite.ts', root).pathname);
const components = await bundle(new URL('packages/web/src/components.ts', root).pathname);
const bind = await bundle(new URL('packages/web/src/bind.ts', root).pathname);
const assets = await bundle(new URL('packages/web/src/assets.ts', root).pathname);
const check = process.argv.includes('--check');
mkdirSync(new URL('packages/web/dist/', root), { recursive: true });
function emit(path: string, text: string, generated = false): void {
  const out = new URL(path, root);
  // dist is ignored: check its contents when present, and generate it on a clean checkout.
  if (check && (!generated || existsSync(out))) {
    if (!existsSync(out) || readFileSync(out, 'utf8') !== text) {
      console.error(`${path} is stale: run node tools/build-web.ts`);
      process.exitCode = 1;
    }
  } else writeFileSync(out, text);
}
emit('packages/web/dist/anima-icon.js', js, true);
emit('packages/web/dist/anima-markup.js', markup, true);
emit('packages/web/dist/anima-markup-libraries.js', libraries, true);
emit('packages/web/dist/anima-paint.js', paint, true);
emit('packages/web/dist/anima-composite.js', composite, true);
emit('packages/web/dist/anima-bind.js', bind, true);
emit('packages/web/dist/anima-assets.js', assets, true);
emit('packages/web/dist/anima-components.js', components, true);

const bell = readFileSync(new URL('examples/bell.ani', root), 'utf8');
const page = readFileSync(new URL('examples/web/template.html', root), 'utf8')
  .replace('<!-- BELL -->', () => bell.trim().replace(/<\//g, '<\\/'))
  .replace('/* RUNTIME */', () => js.trim().replace(/<\/script/gi, '<\\/script'));
emit('examples/web/index.html', page);
console.log(
  `anima-icon.js ${js.length} B; anima-markup.js ${markup.length} B; anima-markup-libraries.js ${libraries.length} B; anima-paint.js ${paint.length} B; anima-composite.js ${composite.length} B; examples/web/index.html ${page.length} B`,
);
