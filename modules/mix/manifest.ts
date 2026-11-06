export const after = ['composite', 'contour', 'surface'];
export default {
  ...{
    name: 'mix',
    after: [],
    core: { entry: 'core/index.ts', export: 'mix', svg: 'core/svg.ts', svgExport: 'mixSVG' },
    web: [{ name: 'mix', budget: 5120 }],
    adapters: {
      'packages/core/src/modules/mix/index.ts': 'core/index.ts',
      'packages/core/src/modules/mix/svg.ts': 'core/svg.ts',
      'packages/markup/src/mix.ts': 'markup/index.ts',
      'packages/web/src/mix.ts': 'web/index.ts',
    },
    exports: {
      'core:./mix': 'packages/core/src/modules/mix/index.ts',
      'markup:./mix': 'packages/markup/src/mix.ts',
      'web:./mix': 'packages/web/src/mix.ts',
    },
    tests: [
      'modules/mix/test/**/*.test.ts',
      'packages/markup/test/corpus.test.ts',
      'packages/markup/test/names.test.ts',
    ],
    conformance: [
      'drawing-paint-blend-additive',
      'drawing-paint-additive-strength',
      'drawing-paint-paint-blend-override',
      'host-api-renderer',
      'host-api-factory',
    ],
    docs: ['spec/SPEC.md'],
  },
  after,
};
