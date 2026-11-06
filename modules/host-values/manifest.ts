export const after = ['data'];
export default {
  name: 'host-values',
  after,
  core: { entry: 'core/index.ts', export: 'hostValues' },
  web: [{ name: 'host-values', budget: 2048 }],
  adapters: {
    'packages/core/src/modules/host-values/index.ts': 'core/index.ts',
    'packages/web/src/host-values.ts': 'web/index.ts',
  },
  exports: {
    'core:./host-values': 'packages/core/src/modules/host-values/index.ts',
    'web:./host-values': 'packages/web/src/host-values.ts',
  },
  tests: ['modules/host/test/core/**/*.test.ts'],
  conformance: [],
  docs: ['modules/host-values/SPEC.md'],
};
