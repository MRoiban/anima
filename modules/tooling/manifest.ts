export default {
  name: 'tooling',
  after: [],
  web: [],
  adapters: {},
  exports: {},
  tests: ['packages/cli/test/agent-tools.test.ts'],
  conformance: ['tooling-input-data'],
  docs: ['spec/SPEC.md', 'docs/AUTHORING.md'],
};
