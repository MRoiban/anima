export default {
  name: 'tooling',
  after: [],
  web: [],
  adapters: {},
  exports: {},
  tests: ['packages/cli/test/agent-tools.test.ts', 'packages/cli/test/tooling-leftovers.test.ts'],
  conformance: ['tooling-input-data', 'tooling-seed', 'tooling-legacy-random'],
  docs: ['spec/SPEC.md', 'docs/AUTHORING.md'],
};
