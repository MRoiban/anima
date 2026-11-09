export const after = ['paint'];
export default {
  name: 'composite',
  after,
  core: {
    entry: 'core/index.ts',
    export: 'composite',
    svg: 'core/svg.ts',
    svgExport: 'compositeSVG',
  },
  web: [
    {
      name: 'composite',
      buildOrder: 4,
      sizeOrder: 7,
      budget: 4160,
    },
  ],
  adapters: {
    'packages/core/src/modules/composite/index.ts': 'core/index.ts',
    'packages/core/src/modules/composite/svg.ts': 'core/svg.ts',
    'packages/web/src/composite.ts': 'web/index.ts',
  },
  exports: {
    'core:./composite': 'packages/core/src/modules/composite/index.ts',
    'core:./composite-svg': 'packages/core/src/modules/composite/svg.ts',
    'web:./composite': 'packages/web/src/composite.ts',
  },
  markupHook: null,
  tests: [
    'modules/composite/test/**/*.test.ts',
    'packages/markup/test/compile.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/decompile.test.ts',
    'packages/markup/test/format.test.ts',
    'packages/markup/test/invalid.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: [
    'paint-blend',
    'paint-clip',
    'paint-draw-order',
    'paint-mask-',
    'input-hit-draw-order',
    'input-focus-pointer-draw-order',
  ],
  docs: ['spec/SPEC.md', 'spec/ANIML.md'],
};
