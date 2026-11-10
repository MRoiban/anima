export const after = ['data', 'host-values'];
export default {
  name: 'host',
  summary: 'Host data API: read scene data and values from page scripts.',
  after,
  core: { entry: 'core/index.ts', export: 'host' },
  web: [{ name: 'host', budget: 3968, over: 'host-values' }],
  adapters: {
    'packages/core/src/modules/host/index.ts': 'core/index.ts',
    'packages/web/src/host.ts': 'web/index.ts',
  },
  exports: {
    'core:./host': 'packages/core/src/modules/host/index.ts',
    'web:./host': 'packages/web/src/host.ts',
  },
  tests: ['modules/host/test/**/*.test.ts'],
  conformance: ['assets-replacement-scope-image'],
  docs: ['modules/host/SPEC.md', 'modules/host/AUTHORING.md'],
};
