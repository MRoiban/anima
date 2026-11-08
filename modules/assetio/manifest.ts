export default {
  name: 'assetio',
  after: [],
  web: [{ name: 'assetio', budget: 768 }],
  adapters: { 'packages/web/src/assetio.ts': 'web/index.ts' },
  exports: { 'web:./assetio': 'packages/web/src/assetio.ts' },
  tests: ['modules/assets/test/**/*.test.ts', 'modules/fonts/test/web/fonts.test.ts'],
  conformance: [],
  docs: ['modules/assetio/SPEC.md'],
};
