export const after = ['a11y-actions'];
export default {
  name: 'a11y-dom',
  after,
  web: [
    { name: 'a11y-dom', budget: 2176, over: 'a11y-actions' },
    { name: 'a11y-navigation', budget: 1536, over: 'a11y-dom' },
  ],
  adapters: {
    'packages/web/src/a11y-dom.ts': 'web/index.ts',
    'packages/web/src/a11y-navigation.ts': 'web/navigation.ts',
  },
  exports: {
    'web:./a11y-dom': 'packages/web/src/a11y-dom.ts',
    'web:./a11y-navigation': 'packages/web/src/a11y-navigation.ts',
  },
  tests: ['modules/a11y-dom/test/**/*.test.ts'],
  conformance: [],
  docs: ['modules/a11y-dom/SPEC.md'],
};
