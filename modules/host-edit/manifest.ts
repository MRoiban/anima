export const after = ['host', 'data'];
export default {
  name: 'host-edit',
  after,
  core: { entry: 'core/index.ts', export: 'hostEdit' },
  web: [{ name: 'host-edit', budget: 4032 }],
  adapters: {
    'packages/core/src/modules/host-edit/index.ts': 'core/index.ts',
    'packages/web/src/host-edit.ts': 'web/index.ts',
  },
  exports: {
    'core:./host-edit': 'packages/core/src/modules/host-edit/index.ts',
    'web:./host-edit': 'packages/web/src/host-edit.ts',
  },
  tests: ['modules/host-edit/test/**/*.test.ts'],
  conformance: [],
  docs: ['modules/host-edit/SPEC.md', 'modules/host-edit/AUTHORING.md'],
};
