export default {
  name: 'markup',
  after: [],
  web: [
    {
      name: 'markup',
      buildOrder: 1,
      sizeOrder: 0,
      budget: 8192,
    },
  ],
  adapters: {
    'packages/web/src/markup.ts': 'web/index.ts',
  },
  exports: {
    'web:./markup': 'packages/web/src/markup.ts',
  },
  tests: ['packages/web/test/markup-hooks.test.ts'],
  conformance: [],
  docs: ['spec/ANIML.md'],
};
