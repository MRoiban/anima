export const after = ['composite'];
export default {
  name: 'surface',
  after,
  core: {
    entry: 'core/index.ts',
    export: 'surface',
    svg: 'core/svg.ts',
    svgExport: 'surfaceSVG',
  },
  web: [
    {
      name: 'surface',
      buildOrder: 11,
      sizeOrder: 10,
      budget: 8192,
    },
    {
      name: 'markup-surface',
      buildOrder: 12,
      sizeOrder: 4,
      budget: 2048,
      over: 'index',
      authoring: true,
    },
  ],
  adapters: {
    'packages/core/src/modules/surface/index.ts': 'core/index.ts',
    'packages/core/src/modules/surface/svg.ts': 'core/svg.ts',
    'packages/web/src/surface.ts': 'web/index.ts',
    'packages/web/src/markup-surface.ts': 'web/markup.ts',
  },
  exports: {
    'core:./surface': 'packages/core/src/modules/surface/index.ts',
    'core:./surface-svg': 'packages/core/src/modules/surface/svg.ts',
    'web:./surface': 'packages/web/src/surface.ts',
    'web:./markup-surface': 'packages/web/src/markup-surface.ts',
  },
  markupHook: null,
  tests: [
    'modules/surface/test/**/*.test.ts',
    'packages/markup/test/compile.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/decompile.test.ts',
    'packages/markup/test/format.test.ts',
    'packages/markup/test/invalid.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: [],
  docs: ['spec/SPEC.md', 'spec/ANIML.md'],
};
