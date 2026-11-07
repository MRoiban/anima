export const after = [];
export default {
  name: 'markup-hooks',
  after,
  core: null,
  web: [],
  adapters: {},
  exports: {},
  tests: ['packages/markup/test/**/*.test.ts', 'packages/web/test/markup-hooks.test.ts'],
  conformance: [],
  docs: ['spec/ANIML.md', 'docs/AUTHORING.md'],
};
