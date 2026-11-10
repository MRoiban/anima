// Focus has no runtime dependency on other optional modules.
export const after = ['components'];
export default {
  ...{
    name: 'focus',
    summary:
      'Keyboard focus: focusable nodes, focus order, focus states and focus-driven listeners.',
    after: [],
    core: { entry: 'core/index.ts', export: 'focus', svg: 'core/svg.ts', svgExport: 'focusSVG' },
    web: [{ name: 'focus', budget: 3456 }],
    adapters: {
      'packages/core/src/modules/focus/index.ts': 'core/index.ts',
      'packages/core/src/modules/focus/svg.ts': 'core/svg.ts',
      'packages/markup/src/focus.ts': 'markup/index.ts',
      'packages/web/src/focus.ts': 'web/index.ts',
    },
    exports: {
      'core:./focus': 'packages/core/src/modules/focus/index.ts',
      'markup:./focus': 'packages/markup/src/focus.ts',
      'web:./focus': 'packages/web/src/focus.ts',
    },
    tests: [
      'modules/focus/test/**/*.test.ts',
      'packages/markup/test/corpus.test.ts',
      'packages/markup/test/names.test.ts',
    ],
    conformance: [
      'input-focus-clear',
      'input-focus-down',
      'input-focus-edge-closed-loop',
      'input-focus-edge-parent-scope',
      'input-focus-edge-stop',
      'input-focus-enabled',
      'input-focus-left',
      'input-focus-next',
      'input-focus-previous',
      'input-focus-pointer',
      'input-focus-right',
      'input-focus-target',
      'input-focus-traverse',
      'input-focus-up',
      'input-listen-blur',
      'input-listen-focus',
    ],
    docs: ['spec/SPEC.md', 'spec/ANIML.md', 'docs/WEB.md'],
  },
  after,
};
