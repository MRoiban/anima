// Test-only reuse of the exact browser artifacts. Size measurements always call bundle() directly.
import { createHash } from 'node:crypto';
import { globSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from './browser-build.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
export const digest = (text: string): string => createHash('sha256').update(text).digest('hex');
export interface BrowserCache {
  source: string;
  entries: Record<string, { file: string; hash: string }>;
}
export function browserFingerprint(base = root): string {
  const hash = createHash('sha256');
  const files = globSync(
    [
      'packages/{core,markup,web}/src/**/*.ts',
      'modules/*/{core,web,markup}/**/*.ts',
      'modules/*/manifest.ts',
      'tools/modules.generated.ts',
      'packages/{core,markup,web}/package.json',
      'packages/{core,markup,web}/tsconfig.json',
      'tools/browser*.ts',
      'tools/build-web.ts',
      'package*.json',
      'tsconfig*.json',
    ],
    { cwd: base },
  ).sort();
  for (const file of files)
    hash
      .update(file)
      .update('\0')
      .update(readFileSync(join(base, file)))
      .update('\0');
  return hash.digest('hex');
}
export function readCachedBundle(entry: string, base = root): string | undefined {
  try {
    const manifest = JSON.parse(
      readFileSync(join(base, 'packages/web/dist/build.json'), 'utf8'),
    ) as BrowserCache;
    if (manifest.source !== browserFingerprint(base)) return;
    const output = manifest.entries[relative(base, resolve(entry))];
    if (!output) return;
    const code = readFileSync(join(base, output.file), 'utf8');
    return digest(code) === output.hash ? code : undefined;
  } catch {
    return undefined;
  }
}
export async function cachedBundle(entry: string): Promise<string> {
  return readCachedBundle(entry) ?? bundle(entry);
}
