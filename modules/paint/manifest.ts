export const after = ['assets'];
export default {
  name: 'paint',
  after,
  core: {
    entry: 'core/index.ts',
    export: 'paint',
    svg: 'core/svg.ts',
    svgExport: 'paintSVG',
  },
  web: [
    {
      name: 'paint',
      buildOrder: 3,
      sizeOrder: 6,
      budget: 5120,
    },
    {
      name: 'markup-paint',
      buildOrder: 10,
      sizeOrder: 3,
      budget: 2048,
      over: 'index',
    },
  ],
  adapters: {
    'packages/core/src/modules/paint/index.ts': 'core/index.ts',
    'packages/core/src/modules/paint/svg.ts': 'core/svg.ts',
    'packages/core/src/modules/paint/geometry.ts': 'core/geometry.ts',
    'packages/web/src/paint.ts': 'web/index.ts',
    'packages/web/src/markup-paint.ts': 'web/markup.ts',
    'packages/markup/src/modules.ts': 'markup/index.ts',
  },
  exports: {
    'core:./paint': 'packages/core/src/modules/paint/index.ts',
    'core:./paint-svg': 'packages/core/src/modules/paint/svg.ts',
    'web:./paint': 'packages/web/src/paint.ts',
    'web:./markup-paint': 'packages/web/src/markup-paint.ts',
    'markup:./modules': 'packages/markup/src/modules.ts',
  },
  markupHook: {
    browserName: 'paint',
    browserBase: 'structuralForms',
    slot: 'moduleCompiler',
    type: 'structuralMarkup',
    value: 'structuralMarkup',
  },
  tests: [
    'modules/paint/test/**/*.test.ts',
    'packages/markup/test/compile.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/decompile.test.ts',
    'packages/markup/test/format.test.ts',
    'packages/markup/test/invalid.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: ['paint-gradient', 'paint-dash', 'paint-morph', 'paint-pose-morph', 'paint-shape-'],
  docs: ['spec/SPEC.md', 'spec/ANIML.md'],
};
