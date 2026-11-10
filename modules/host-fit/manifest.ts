export const after: string[] = [];
export default {
  name: 'host-fit',
  summary:
    'Browser entry: fit and alignment of the scene inside its <anima-icon> element (contain, cover, fill, layout).',
  after,
  web: [
    { name: 'host-fit', budget: 768, over: 'host-fit-size' },
    { name: 'host-fit-size', budget: 512 },
  ],
  adapters: {
    'packages/web/src/host-fit.ts': 'web/index.ts',
    'packages/web/src/host-fit-size.ts': 'web/size.ts',
  },
  exports: {
    'web:./host-fit': 'packages/web/src/host-fit.ts',
    'web:./host-fit-size': 'packages/web/src/host-fit-size.ts',
  },
  tests: ['modules/host-fit/test/**/*.test.ts', 'packages/markup/test/corpus.test.ts'],
  conformance: [],
  docs: ['spec/SPEC.md', 'docs/WEB.md'],
};
