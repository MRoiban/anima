export const after = [];
export default {
  name: 'markup-animation',
  after,
  core: null,
  web: [{ name: 'markup-animation', over: 'markup', budget: 1536, authoring: true }],
  adapters: { 'packages/web/src/markup-animation.ts': 'web/index.ts' },
  exports: { 'web:./markup-animation': 'packages/web/src/markup-animation.ts' },
  markupHook: {
    slot: 'animationCompiler',
    type: 'animationMarkup',
    value: 'animationMarkup',
    browserName: 'animation',
  },
  tests: [
    'packages/markup/test/**/*.test.ts',
    'modules/markup-animation/test/**/*.test.ts',
    'packages/web/test/markup-hooks.test.ts',
  ],
  conformance: [],
  docs: ['spec/ANIML.md', 'docs/AUTHORING.md'],
};
