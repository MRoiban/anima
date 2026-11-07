export const after = ['assets', 'host', 'host-edit'];
export default {
  ...{
    name: 'fonts',
    after: [],
    core: { entry: 'core/index.ts', export: 'fonts', svg: 'core/svg.ts', svgExport: 'fontsSVG' },
    web: [{ name: 'fonts', budget: 2048 }],
    adapters: {
      'packages/core/src/modules/fonts/index.ts': 'core/index.ts',
      'packages/core/src/modules/fonts/svg.ts': 'core/svg.ts',
      'packages/markup/src/fonts.ts': 'markup/index.ts',
      'packages/web/src/fonts.ts': 'web/index.ts',
    },
    exports: {
      'core:./fonts': 'packages/core/src/modules/fonts/index.ts',
      'markup:./fonts': 'packages/markup/src/fonts.ts',
      'web:./fonts': 'packages/web/src/fonts.ts',
    },
    tests: [
      'modules/fonts/test/**/*.test.ts',
      'packages/markup/test/corpus.test.ts',
      'packages/markup/test/names.test.ts',
    ],
    conformance: [
      'assets-font',
      'assets-host-decode-font',
      'assets-replacement-scope-font',
      'data-host-font',
      'host-api-data-font',
      'host-api-font-fallback',
      'text-font-fallback',
      'text-font-assets',
      'text-font-decoding',
      'text-variable-axes',
      'text-opentype-features',
      'text-font-metrics',
    ],
    docs: ['spec/SPEC.md'],
  },
  after,
};
