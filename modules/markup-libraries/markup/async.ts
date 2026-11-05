import { compile } from '../../../packages/markup/src/compile.ts';
import type { CompileOptions, CompileResult } from '../../../packages/markup/src/index.ts';
import { attr, importPath } from './reuse.ts';
import { parseXml } from '../../../packages/markup/src/xml.ts';

/** Async host variant (e.g. fetch). The sync API remains available for import-free markup. */
export async function compileLibrariesAsync(
  source: string,
  opts: Omit<CompileOptions, 'resolve'> & {
    resolve: (path: string) => string | Promise<string>;
  },
): Promise<CompileResult> {
  const cache = new Map<string, string>();
  const seen = new Set<string>([opts.file ?? '']);
  const visit = async (text: string, file?: string): Promise<void> => {
    const root = parseXml(text).doc.root;
    if (!root) return;
    for (const el of root.children) {
      if (el.kind !== 'element' || el.name !== 'import') continue;
      const path = importPath(attr(el, 'src'), file);
      if (seen.has(path)) continue;
      seen.add(path);
      try {
        const imported = await opts.resolve(path);
        cache.set(path, imported);
        await visit(imported, path);
      } catch {
        /* Sync expansion reports the failure with its import position. */
      }
    }
  };
  await visit(source, opts.file);
  return compile(source, {
    ...opts,
    resolve: (path) => {
      if (!cache.has(path)) throw Error('unreadable import');
      return cache.get(path)!;
    },
  });
}
