export const after: string[] = [];
export default {
  name: 'host-fit',
  after,
  web: [{ name: 'host-fit', budget: 768 }],
  adapters: { 'packages/web/src/host-fit.ts': 'web/index.ts' },
  exports: { 'web:./host-fit': 'packages/web/src/host-fit.ts' },
  tests: ['modules/host-fit/test/**/*.test.ts', 'packages/markup/test/corpus.test.ts'],
  conformance: [],
  docs: ['spec/SPEC.md', 'docs/WEB.md'],
};
