export const after = ['a11y'];
export default {
  name: 'a11y-actions',
  after,
  core: { entry: 'core/index.ts', export: 'a11yActions' },
  web: [{ name: 'a11y-actions', budget: 1216, over: 'a11y' }],
  adapters: {
    'packages/core/src/modules/a11y-actions/index.ts': 'core/index.ts',
    'packages/web/src/a11y-actions.ts': 'web/index.ts',
  },
  exports: {
    'core:./a11y-actions': 'packages/core/src/modules/a11y-actions/index.ts',
    'web:./a11y-actions': 'packages/web/src/a11y-actions.ts',
  },
  tests: ['modules/a11y/test/**/*.test.ts', 'modules/a11y-actions/test/**/*.test.ts'],
  conformance: [],
  docs: ['modules/a11y/SPEC.md'],
};
