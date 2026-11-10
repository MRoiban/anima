export const after = [];
export default {
  name: 'devtools',
  summary: 'Authoring tool: host-only inspection APIs for debugging scenes in the browser.',
  after,
  core: null,
  web: [{ name: 'devtools', budget: 448, authoring: true }],
  adapters: { 'packages/web/src/devtools.ts': 'web/index.ts' },
  exports: { 'web:./devtools': 'packages/web/src/devtools.ts' },
  tests: ['modules/devtools/test/**/*.test.ts', 'packages/web/test/browser.test.ts'],
  conformance: [],
  docs: ['modules/devtools/SPEC.md'],
};
