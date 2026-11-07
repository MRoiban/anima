export const after = [];
export default {
  name: 'devtools',
  after,
  core: null,
  web: [{ name: 'devtools', budget: 1024, authoring: true }],
  adapters: { 'packages/web/src/devtools.ts': 'web/index.ts' },
  exports: { 'web:./devtools': 'packages/web/src/devtools.ts' },
  tests: ['modules/devtools/test/**/*.test.ts', 'packages/web/test/browser.test.ts'],
  conformance: [],
  docs: ['modules/devtools/SPEC.md'],
};
