export const after = ['paint', 'composite', 'surface'];
export default {
  name: 'colormix',
  summary:
    'Colour mixing: a fill or stroke colour that mixes two colours or slots by an animatable amount.',
  after,
  core: {
    entry: 'core/index.ts',
    export: 'colormix',
    svg: 'core/svg.ts',
    svgExport: 'colormixSVG',
  },
  web: [
    { name: 'colormix', budget: 3072 },
    { name: 'markup-colormix', budget: 512, over: 'index', authoring: true },
  ],
  adapters: {
    'packages/core/src/modules/colormix/index.ts': 'core/index.ts',
    'packages/core/src/modules/colormix/svg.ts': 'core/svg.ts',
    'packages/web/src/colormix.ts': 'web/index.ts',
    'packages/web/src/markup-colormix.ts': 'web/markup.ts',
    'packages/markup/src/colormix.ts': 'markup/index.ts',
  },
  exports: {
    'core:./colormix': 'packages/core/src/modules/colormix/index.ts',
    'web:./colormix': 'packages/web/src/colormix.ts',
    'web:./markup-colormix': 'packages/web/src/markup-colormix.ts',
    'markup:./colormix': 'packages/markup/src/colormix.ts',
  },
  tests: [
    'modules/colormix/test/**/*.test.ts',
    'packages/markup/test/compile.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/decompile.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: [],
  docs: ['spec/SPEC.md'],
};
