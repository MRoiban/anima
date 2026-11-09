// The generated registry preserves discover()/ordered()'s manifest `after` order.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { bundle } from '../../../tools/browser-build.ts';
import { webOwners } from '../../../tools/modules.generated.ts';

const root = new URL('../../../', import.meta.url);
const entries = Object.keys(webOwners);

function distance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(Math.min(next[j]! + 1, row[j + 1]! + 1, row[j]! + Number(a[i] !== b[j])));
    row = next;
  }
  return row[b.length]!;
}

export async function bundleBrowser(names: string | undefined, output: string, verbose: boolean) {
  const requested = names === undefined ? [] : names.split(',').map((name) => name.trim());
  for (const [index, name] of requested.entries()) {
    if (Object.hasOwn(webOwners, name)) continue;
    const suggestion = [...entries].sort((a, b) => distance(name, a) - distance(name, b))[0];
    throw Object.assign(new Error(`unknown browser module "${name}"`), {
      code: 'bundle-module',
      pointer: `/modules/${index}`,
      hint: `did you mean "${suggestion}"? Valid names: ${entries.join(', ')}`,
    });
  }
  const modules = entries.filter((name) => requested.includes(name));
  const entry = (name: string) => fileURLToPath(new URL(`packages/web/src/${name}.ts`, root));
  // Real entry points for zero/one module preserve dist's exact bytes, including its exports.
  const source =
    modules.length <= 1
      ? entry(modules[0] ?? 'index')
      : {
          contents: modules
            .map((name) => `export * from ${JSON.stringify(entry(name))};`)
            .join('\n'),
          resolveDir: fileURLToPath(root),
          loader: 'ts' as const,
        };
  const code = await bundle(source, verbose);
  writeFileSync(output, code);
  return {
    wrote: output,
    modules,
    verbose,
    min: Buffer.byteLength(code),
    gzip: gzipSync(code).length,
  };
}
