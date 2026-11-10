export default {
  name: 'markup',
  summary: 'Authoring: the AniML markup compiler and decompiler (.animl ↔ .ani).',
  after: [],
  web: [
    {
      name: 'markup',
      buildOrder: 1,
      sizeOrder: 0,
      budget: 8192,
      authoring: true,
    },
    { name: 'markup-hooks', over: 'markup', budget: 4544, authoring: true },
  ],
  adapters: {
    'packages/web/src/markup.ts': 'web/index.ts',
    'packages/web/src/markup-hooks.ts': 'web/hooks.ts',
  },
  exports: {
    'web:./markup': 'packages/web/src/markup.ts',
    'web:./markup-hooks': 'packages/web/src/markup-hooks.ts',
  },
  tests: ['packages/web/test/markup-hooks.test.ts', 'modules/markup/test/**/*.test.ts'],
  conformance: [],
  docs: ['spec/ANIML.md'],
};
