export const after = ['bind'];
export default {
  name: 'assets',
  after,
  core: {
    entry: 'core/index.ts',
    export: 'assets',
    svg: 'core/svg.ts',
    svgExport: 'assetsSVG',
  },
  web: [
    {
      name: 'assets',
      buildOrder: 7,
      sizeOrder: 9,
      budget: 2048,
    },
  ],
  adapters: {
    'packages/core/src/modules/assets/index.ts': 'core/index.ts',
    'packages/core/src/modules/assets/svg.ts': 'core/svg.ts',
    'packages/web/src/assets.ts': 'web/index.ts',
  },
  exports: {
    'core:./assets': 'packages/core/src/modules/assets/index.ts',
    'core:./assets-svg': 'packages/core/src/modules/assets/svg.ts',
    'web:./assets': 'packages/web/src/assets.ts',
  },
  markupHook: null,
  tests: [
    'modules/assets/test/**/*.test.ts',
    'packages/markup/test/compile.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/decompile.test.ts',
    'packages/markup/test/format.test.ts',
    'packages/markup/test/invalid.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: ['assets-'],
  docs: ['spec/SPEC.md', 'spec/ANIML.md'],
};
