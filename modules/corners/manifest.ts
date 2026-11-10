export const after: string[] = [];
export default {
  name: 'corners',
  summary: 'Rectangle corner radii (and the rounded geometry) for scenes that don’t load paint.',
  after,
  core: { entry: 'core/index.ts', export: 'corners' },
  web: [{ name: 'corners', budget: 1024 }],
  adapters: {
    'packages/core/src/modules/corners/index.ts': 'core/index.ts',
    'packages/web/src/corners.ts': 'web/index.ts',
  },
  exports: {
    'core:./corners': 'packages/core/src/modules/corners/index.ts',
    'web:./corners': 'packages/web/src/corners.ts',
  },
  tests: [
    'modules/corners/test/**/*.test.ts',
    'packages/markup/test/compile.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/decompile.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: ['paint-shape-corners'],
  docs: ['spec/SPEC.md'],
};
