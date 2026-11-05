// Builds the base and optional markup browser bundles (packages/web/dist/) and the standalone
// demo (examples/web/index.html: base bundle and bell.ani inlined, so it makes no requests).
//   node tools/build-web.ts [--check]   (--check: fail if the demo or existing bundles are stale)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { browserFingerprint, digest, type BrowserCache } from './browser-cache.ts';

const root = new URL('../', import.meta.url);
import { webEntries as entries } from './modules.generated.ts';
const outputs = new Map<string, string>();
await Promise.all(
  Array.from(
    { length: 4 },
    (_, lane) =>
      new Promise<void>((resolve, reject) => {
        const worker = new Worker(new URL('./browser-build-worker.ts', import.meta.url), {
          workerData: entries
            .filter((_, i) => i % 4 === lane)
            .map((name) => new URL(`packages/web/src/${name}.ts`, root).pathname),
        });
        worker.on('message', ([path, code]: [string, string]) => outputs.set(path, code));
        worker.on('error', reject);
        worker.on('exit', (code) =>
          code === 0 ? resolve() : reject(Error(`browser build worker exited ${code}`)),
        );
      }),
  ),
);
const js = outputs.get(new URL('packages/web/src/index.ts', root).pathname)!;
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
const manifest: BrowserCache = { source: browserFingerprint(), entries: {} };
for (const name of entries) {
  const code = outputs.get(new URL(`packages/web/src/${name}.ts`, root).pathname);
  if (code === undefined) throw Error(`browser entry ${name} did not build`);
  const file = `packages/web/dist/anima-${name === 'index' ? 'icon' : name}.js`;
  emit(file, code, true);
  manifest.entries[`packages/web/src/${name}.ts`] = { file, hash: digest(code) };
}

emit('packages/web/dist/build.json', JSON.stringify(manifest, null, 2) + '\n', true);

const bell = readFileSync(new URL('examples/bell.ani', root), 'utf8');
const page = readFileSync(new URL('examples/web/template.html', root), 'utf8')
  .replace('<!-- BELL -->', () => bell.trim().replace(/<\//g, '<\\/'))
  .replace('/* RUNTIME */', () => js.trim().replace(/<\/script/gi, '<\\/script'));
emit('examples/web/index.html', page);
console.log(`Built ${entries.length} browser entries; examples/web/index.html ${page.length} B`);
