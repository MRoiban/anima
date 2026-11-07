export const after = ['host', 'data', 'assets', 'input'];
export default {
  name: 'data-host',
  after,
  core: { entry: 'core/index.ts', export: 'dataHost' },
  web: [{ name: 'data-host', budget: 1088 }],
  adapters: {
    'packages/core/src/modules/data-host/index.ts': 'core/index.ts',
    'packages/web/src/data-host.ts': 'web/index.ts',
  },
  exports: {
    'core:./data-host': 'packages/core/src/modules/data-host/index.ts',
    'web:./data-host': 'packages/web/src/data-host.ts',
  },
  tests: [
    'modules/data-host/test/**/*.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: ['data-host', 'transforms-computed-transform-values'],
  docs: ['modules/data-host/SPEC.md'],
};
