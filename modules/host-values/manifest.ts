export const after = ['data'];
export default {
  name: 'host-values',
  after,
  core: { entry: 'core/index.ts', export: 'hostValues' },
  web: [{ name: 'host-values', budget: 1344 }],
  adapters: {
    'packages/core/src/modules/host-values/index.ts': 'core/index.ts',
    'packages/web/src/host-values.ts': 'web/index.ts',
    'packages/web/src/hostvalues.ts': 'web/index.ts',
  },
  exports: {
    'core:./host-values': 'packages/core/src/modules/host-values/index.ts',
    'web:./host-values': 'packages/web/src/host-values.ts',
    'web:./hostvalues': 'packages/web/src/hostvalues.ts',
  },
  tests: ['modules/host/test/core/**/*.test.ts'],
  conformance: [],
  docs: ['modules/host-values/SPEC.md'],
};
