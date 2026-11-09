// TODO: review dependencies and measured budget before implementation.
export const after: string[] = [];
export default {
  ...{
    name: 'scroll',
    after: [],
    core: { entry: 'core/index.ts', export: 'scroll', svg: 'core/svg.ts', svgExport: 'scrollSVG' },
    web: [{ name: 'scroll', budget: 5120 }],
    adapters: {
      'packages/core/src/modules/scroll/index.ts': 'core/index.ts',
      'packages/core/src/modules/scroll/svg.ts': 'core/svg.ts',
      'packages/markup/src/scroll.ts': 'markup/index.ts',
      'packages/web/src/scroll.ts': 'web/index.ts',
    },
    exports: {
      'core:./scroll': 'packages/core/src/modules/scroll/index.ts',
      'markup:./scroll': 'packages/markup/src/scroll.ts',
      'web:./scroll': 'packages/web/src/scroll.ts',
    },
    tests: [
      'modules/scroll/test/**/*.test.ts',
      'packages/markup/test/corpus.test.ts',
      'packages/markup/test/names.test.ts',
    ],
    conformance: ['rigging-scroll'],
    docs: ['spec/SPEC.md'],
  },
  after,
};
