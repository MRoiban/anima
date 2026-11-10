export const after = ['components'];
export default {
  name: 'bind',
  summary:
    'Bindings: drive any animatable or bindable address from input expressions (math, comparisons, contains, lower…).',
  after,
  core: {
    entry: 'core/index.ts',
    export: 'bind',
  },
  web: [
    {
      name: 'bind',
      buildOrder: 6,
      sizeOrder: 8,
      budget: 2048,
    },
    {
      name: 'markup-bind',
      buildOrder: 9,
      sizeOrder: 5,
      budget: 192,
      over: 'index',
      authoring: true,
    },
  ],
  adapters: {
    'packages/core/src/modules/bind/index.ts': 'core/index.ts',
    'packages/core/src/modules/bind/expression.ts': 'core/expression.ts',
    'packages/web/src/bind.ts': 'web/index.ts',
    'packages/web/src/markup-bind.ts': 'web/markup.ts',
    'packages/markup/src/bind.ts': 'markup/index.ts',
  },
  exports: {
    'core:./bind': 'packages/core/src/modules/bind/index.ts',
    'web:./bind': 'packages/web/src/bind.ts',
    'web:./markup-bind': 'packages/web/src/markup-bind.ts',
    'markup:./bind': 'packages/markup/src/bind.ts',
  },
  markupHook: {
    browserName: 'bind',
    slot: 'bindCompiler',
    type: 'bindMarkup',
    value: 'bindMarkup',
  },
  tests: [
    'modules/bind/test/**/*.test.ts',
    'packages/markup/test/compile.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/decompile.test.ts',
    'packages/markup/test/format.test.ts',
    'packages/markup/test/invalid.test.ts',
    'packages/markup/test/names.test.ts',
    'modules/components/test/markup/components.test.ts',
  ],
  conformance: ['bind-', 'data-bind-listener-actions'],
  docs: ['spec/SPEC.md', 'spec/ANIML.md'],
};
