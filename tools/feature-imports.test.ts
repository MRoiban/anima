// Every `requires` feature names a browser import: the loader's `unknown-feature` hint says
// "import '@anima-format/web/<feature>'", so that path must exist for each registered feature.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import '../packages/core/src/all.ts';
import { FEATURES } from '../packages/core/src/modules.ts';

it('exports @anima-format/web/<feature> for every registered feature', () => {
  const exports = JSON.parse(readFileSync('packages/web/package.json', 'utf8')).exports;
  // `knockout` is core-only: it needs no browser import.
  const missing = FEATURES.filter((f) => f !== 'knockout' && !exports['./' + f]);
  expect(missing).toEqual([]);
});
