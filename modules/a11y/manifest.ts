// Ordering constraints only; optional peers are not dependencies. Budget failure: REPORT.md.
export const after = ['data', 'focus', 'lists'];
export default {
  ...{
    name: 'a11y',
    after: [],
    core: { entry: 'core/index.ts', export: 'a11y', svg: 'core/svg.ts', svgExport: 'a11ySVG' },
    web: [
      { name: 'a11y', budget: 2496 },
      { name: 'a11y-text', budget: 576, over: 'a11y' },
      { name: 'a11y-bounds', budget: 4096, over: 'a11y' },
      { name: 'markup-a11y', budget: 1088, over: 'index', authoring: true },
    ],
    adapters: {
      'packages/core/src/modules/a11y/index.ts': 'core/index.ts',
      'packages/core/src/modules/a11y/svg.ts': 'core/svg.ts',
      'packages/markup/src/a11y.ts': 'markup/index.ts',
      'packages/web/src/a11y.ts': 'web/index.ts',
      'packages/web/src/a11y-text.ts': 'web/text.ts',
      'packages/web/src/a11y-bounds.ts': 'web/bounds.ts',
      'packages/core/src/modules/a11y/text.ts': 'core/text.ts',
      'packages/web/src/markup-a11y.ts': 'web/markup.ts',
    },
    exports: {
      'core:./a11y': 'packages/core/src/modules/a11y/index.ts',
      'markup:./a11y': 'packages/markup/src/a11y.ts',
      'core:./a11y-text': 'packages/core/src/modules/a11y/text.ts',
      'web:./a11y-text': 'packages/web/src/a11y-text.ts',
      'web:./a11y-bounds': 'packages/web/src/a11y-bounds.ts',
      'web:./a11y': 'packages/web/src/a11y.ts',
      'web:./markup-a11y': 'packages/web/src/markup-a11y.ts',
    },
    tests: [
      'modules/a11y/test/**/*.test.ts',
      'packages/markup/test/corpus.test.ts',
      'packages/markup/test/names.test.ts',
    ],
    conformance: ['a11y-', 'a11y-inferred-text', 'a11y-tree-bounds'],
    docs: [
      'spec/SPEC.md',
      'modules/a11y/SPEC.md',
      'modules/a11y/AUTHORING.md',
      'modules/a11y/TEXT.md',
    ],
  },
  after,
};
