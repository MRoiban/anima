import { defineConfig } from 'vitest/config';
import type { Scope } from './tools/test-scope-map.ts';

// The default config remains the complete suite. Only test:scope supplies this plan.
const scope = JSON.parse(process.env.ANIMA_TEST_SCOPE ?? '{}') as Scope;
if (!scope.unit) throw Error('Use npm run test:scope -- <target…>');
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'scope-unit', include: scope.unit } },
      {
        test: {
          name: 'scope-conformance',
          include: scope.conformance,
          testNamePattern: scope.casePattern,
        },
      },
      {
        test: {
          name: 'scope-browser',
          include: scope.browser,
          testNamePattern: scope.browserPattern ? new RegExp(scope.browserPattern, 'i') : undefined,
        },
      },
    ].filter((p) => p.test.include.length),
  },
});
