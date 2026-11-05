// Serve-time build: no committed bundle to go stale. The CLI and browser tests call this function.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

export async function buildPlayground(): Promise<string> {
  const root = new URL('../packages/playground/src/', import.meta.url);
  const [result, html, css] = await Promise.all([
    build({
      entryPoints: [new URL('app.ts', root).pathname],
      bundle: true,
      write: false,
      format: 'iife',
      target: 'es2022',
      minify: true,
    }),
    readFile(new URL('page.html', root), 'utf8'),
    readFile(new URL('style.css', root), 'utf8'),
  ]);
  return html
    .replace('/* STYLE */', () => css)
    .replace('/* SCRIPT */', () =>
      result.outputFiles![0]!.text.replace(/<\/script/gi, '<\\/script'),
    );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const html = await buildPlayground();
  await mkdir(new URL('../packages/playground/dist/', import.meta.url), { recursive: true });
  await writeFile(new URL('../packages/playground/dist/index.html', import.meta.url), html);
  console.log(
    `playground: ${Buffer.byteLength(html)} B, self-contained HTML (built fresh at serve time)`,
  );
}
