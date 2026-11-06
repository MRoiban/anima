import { defineConfig } from 'vitest/config';

// Browser suites launch Chromium and Firefox and are CPU-heavy; on a small CI runner they starved
// the unit tests into timeouts when everything ran at once. `npm test` runs the unit project first,
// then the browser project with a bounded worker count. Limits and coverage are unchanged.
export const browserTests = [
  'modules/*/test/web/**/*.test.ts',
  'packages/web/test/browser.test.ts',
  'packages/web/test/markup-hooks.test.ts',
  'packages/playground/test/browser.test.ts',
];
const all = ['packages/*/test/**/*.test.ts', 'tools/**/*.test.ts', 'modules/*/test/**/*.test.ts'];

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: all, exclude: browserTests } },
      { test: { name: 'browser', include: browserTests } },
    ],
  },
});
