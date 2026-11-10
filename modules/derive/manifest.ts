export const after = ['data', 'bind', 'convert'];
export default {
  name: 'derive',
  summary: 'Derived data: computed, read-only model properties from expressions.',
  after,
  core: { entry: 'core/index.ts', export: 'derive' },
  web: [{ name: 'derive', budget: 2624 }],
  adapters: {
    'packages/core/src/modules/derive/index.ts': 'core/index.ts',
    'packages/web/src/derive.ts': 'web/index.ts',
  },
  exports: {
    'core:./derive': 'packages/core/src/modules/derive/index.ts',
    'web:./derive': 'packages/web/src/derive.ts',
  },
  tests: [
    'modules/derive/test/**/*.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/names.test.ts',
    'packages/markup/test/decompile.test.ts',
  ],
  conformance: ['derive-', 'bind-comparisons'],
  docs: ['modules/derive/SPEC.md'],
};
