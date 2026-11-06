export const after = ['data'];
export default {
  name: 'host',
  after,
  core: { entry: 'core/index.ts', export: 'host' },
  web: [{ name: 'host', budget: 4096 }],
  adapters: {
    'packages/core/src/modules/host/index.ts': 'core/index.ts',
    'packages/web/src/host.ts': 'web/index.ts',
  },
  exports: {
    'core:./host': 'packages/core/src/modules/host/index.ts',
    'web:./host': 'packages/web/src/host.ts',
  },
  tests: ['modules/host/test/**/*.test.ts'],
  conformance: [],
  docs: ['modules/host/SPEC.md', 'modules/host/AUTHORING.md'],
};
