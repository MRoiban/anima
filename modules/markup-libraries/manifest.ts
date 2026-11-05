export const after = [];
export default {
  name: 'markup-libraries',
  after,
  core: null,
  web: [
    {
      name: 'markup-libraries',
      buildOrder: 2,
      sizeOrder: 1,
      budget: 2048,
      over: 'markup',
    },
  ],
  adapters: {
    'packages/markup/src/reuse.ts': 'markup/reuse.ts',
    'packages/markup/src/libraries-async.ts': 'markup/async.ts',
    'packages/markup/src/libraries.ts': 'markup/index.ts',
    'packages/markup/src/library-hooks.ts': 'markup/hooks.ts',
    'packages/web/src/markup-libraries.ts': 'web/index.ts',
  },
  exports: {
    'markup:./libraries': 'packages/markup/src/libraries.ts',
    'markup:./library-hooks': 'packages/markup/src/library-hooks.ts',
    'web:./markup-libraries': 'packages/web/src/markup-libraries.ts',
  },
  markupHook: null,
  tests: ['modules/markup-libraries/test/**/*.test.ts'],
  conformance: [],
  docs: ['spec/SPEC.md', 'spec/ANIML.md'],
};
