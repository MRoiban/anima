import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  browserFingerprint,
  digest,
  readCachedBundle,
  type BrowserCache,
} from './browser-cache.ts';
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'anima-browser-cache-'));
  dirs.push(root);
  for (const path of ['packages/web/src', 'packages/web/dist', 'packages/core/src', 'tools'])
    mkdirSync(join(root, path), { recursive: true });
  const entry = join(root, 'packages/web/src/index.ts');
  writeFileSync(entry, 'export const icon = 1;');
  const file = 'packages/web/dist/anima-icon.js';
  const code = 'export const icon=1;';
  writeFileSync(join(root, file), code);
  const manifest: BrowserCache = {
    source: browserFingerprint(root),
    entries: { 'packages/web/src/index.ts': { file, hash: digest(code) } },
  };
  writeFileSync(join(root, 'packages/web/dist/build.json'), JSON.stringify(manifest));
  return { root, entry, code, file };
};
it('reuses byte-identical artifacts only for the current source fingerprint', () => {
  const { root, entry, code } = fixture();
  expect(readCachedBundle(entry, root)).toBe(code);
  writeFileSync(entry, 'export const icon = 2;');
  expect(readCachedBundle(entry, root)).toBeUndefined();
});
it.each(['packages/core/src/added.ts', 'tools/browser-build.ts', 'package-lock.json'])(
  'invalidates changed registry/build/dependency input %s',
  (path) => {
    const { root, entry } = fixture();
    writeFileSync(join(root, path), 'changed');
    expect(readCachedBundle(entry, root)).toBeUndefined();
  },
);
it('rejects changed output bytes and missing entries/manifests', () => {
  const { root, entry, file } = fixture();
  expect(readCachedBundle(join(root, 'packages/web/src/absent.ts'), root)).toBeUndefined();
  writeFileSync(join(root, file), 'stale');
  expect(readCachedBundle(entry, root)).toBeUndefined();
  rmSync(join(root, 'packages/web/dist/build.json'));
  expect(readCachedBundle(entry, root)).toBeUndefined();
});
