export const after = [];
export default {
  name: 'components',
  after,
  core: {
    entry: 'core/index.ts',
    export: 'components',
    svg: 'core/svg.ts',
    svgExport: 'componentsSVG',
  },
  web: [
    {
      name: 'components',
      buildOrder: 5,
      sizeOrder: 11,
      budget: 4096,
    },
    {
      name: 'markup-components',
      buildOrder: 8,
      sizeOrder: 2,
      budget: 2048,
      over: 'index',
      authoring: true,
    },
  ],
  adapters: {
    'packages/core/src/modules/components/index.ts': 'core/index.ts',
    'packages/core/src/modules/components/svg.ts': 'core/svg.ts',
    'packages/web/src/components.ts': 'web/index.ts',
    'packages/web/src/markup-components.ts': 'web/markup.ts',
    'packages/markup/src/components.ts': 'markup/index.ts',
  },
  exports: {
    'core:./components': 'packages/core/src/modules/components/index.ts',
    'core:./components-svg': 'packages/core/src/modules/components/svg.ts',
    'web:./components': 'packages/web/src/components.ts',
    'web:./markup-components': 'packages/web/src/markup-components.ts',
    'markup:./components': 'packages/markup/src/components.ts',
  },
  markupHook: {
    browserName: 'components',
    slot: 'componentCompiler',
    type: 'componentMarkup',
    value: 'componentMarkup',
  },
  tests: [
    'modules/components/test/**/*.test.ts',
    'packages/markup/test/compile.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/decompile.test.ts',
    'packages/markup/test/format.test.ts',
    'packages/markup/test/invalid.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: ['components-'],
  docs: ['spec/SPEC.md', 'spec/ANIML.md'],
};
