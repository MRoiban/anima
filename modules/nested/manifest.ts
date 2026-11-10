export const after = ['components', 'data', 'bind', 'lists', 'motion'];
export default {
  ...{
    name: 'nested',
    summary:
      'Nested scenes: embed another scene’s animation with remapped or quantized time, and read its outputs.',
    after: [],
    core: { entry: 'core/index.ts', export: 'nested', svg: 'core/svg.ts', svgExport: 'nestedSVG' },
    web: [{ name: 'nested', budget: 5056 }],
    adapters: {
      'packages/core/src/modules/nested/index.ts': 'core/index.ts',
      'packages/core/src/modules/nested/svg.ts': 'core/svg.ts',
      'packages/markup/src/nested.ts': 'markup/index.ts',
      'packages/web/src/nested.ts': 'web/index.ts',
    },
    exports: {
      'core:./nested': 'packages/core/src/modules/nested/index.ts',
      'markup:./nested': 'packages/markup/src/nested.ts',
      'web:./nested': 'packages/web/src/nested.ts',
    },
    tests: [
      'modules/nested/test/**/*.test.ts',
      'packages/markup/test/corpus.test.ts',
      'packages/markup/test/names.test.ts',
    ],
    conformance: [
      'components-nested-remap',
      'components-nested-quantize',
      'components-quantize-boundary',
      'components-leaf-fit',
      'components-stateful-output',
      'components-output-repeat',
      'data-property-artboard',
      'state-machine-literal-artboard',
    ],
    docs: ['modules/nested/SPEC.md'],
  },
  after,
};
