export default {
  name: 'assetio',
  after: [],
  web: [{ name: 'assetio', budget: 2048 }],
  adapters: { 'packages/web/src/assetio.ts': 'web/index.ts' },
  exports: { 'web:./assetio': 'packages/web/src/assetio.ts' },
  tests: ['modules/assets/test/**/*.test.ts'],
  conformance: [],
  docs: ['modules/assetio/SPEC.md'],
};
