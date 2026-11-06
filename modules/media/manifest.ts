export const after = ['assets'];
export default {
  name: 'media',
  after,
  core: { entry: 'core/index.ts', export: 'media' },
  web: [{ name: 'media', budget: 3072 }],
  adapters: {
    'packages/core/src/modules/media/index.ts': 'core/index.ts',
    'packages/web/src/media.ts': 'web/index.ts',
  },
  exports: {
    'core:./media': 'packages/core/src/modules/media/index.ts',
    'web:./media': 'packages/web/src/media.ts',
  },
  markupHook: null,
  tests: ['modules/assets/test/web/pipeline.test.ts'],
  conformance: [],
  docs: ['spec/SPEC.md', 'docs/AUTHORING.md'],
};
