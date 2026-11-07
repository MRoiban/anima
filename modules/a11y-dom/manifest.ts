export const after = ['a11y-actions'];
export default {
  name: 'a11y-dom',
  after,
  web: [{ name: 'a11y-dom', budget: 2048, over: 'a11y-actions' }],
  adapters: { 'packages/web/src/a11y-dom.ts': 'web/index.ts' },
  exports: { 'web:./a11y-dom': 'packages/web/src/a11y-dom.ts' },
  tests: ['modules/a11y-dom/test/**/*.test.ts'],
  conformance: [],
  docs: ['modules/a11y-dom/SPEC.md'],
};
