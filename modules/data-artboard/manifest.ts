export const after = ['nested', 'host'];
export default {
  name: 'data-artboard',
  summary:
    'Data: component-valued model properties (choose which component an instance shows from data).',
  after,
  core: { entry: 'core/index.ts', export: 'dataArtboard' },
  web: [
    { name: 'data-artboard', budget: 1024, over: 'data-artboard-values' },
    { name: 'data-artboard-values', budget: 1536, over: 'nested' },
    { name: 'markup-data-artboard', budget: 256, authoring: true, over: 'markup-hooks' },
  ],
  adapters: {
    'packages/core/src/modules/data-artboard/index.ts': 'core/index.ts',
    'packages/web/src/data-artboard.ts': 'web/index.ts',
    'packages/web/src/dataartboard.ts': 'web/index.ts',
    'packages/web/src/data-artboard-values.ts': 'web/values.ts',
    'packages/web/src/markup-data-artboard.ts': 'web/markup.ts',
    'packages/markup/src/data-artboard.ts': 'markup/index.ts',
  },
  exports: {
    'core:./data-artboard': 'packages/core/src/modules/data-artboard/index.ts',
    'web:./data-artboard': 'packages/web/src/data-artboard.ts',
    'web:./dataartboard': 'packages/web/src/dataartboard.ts',
    'web:./data-artboard-values': 'packages/web/src/data-artboard-values.ts',
    'web:./markup-data-artboard': 'packages/web/src/markup-data-artboard.ts',
    'markup:./data-artboard': 'packages/markup/src/data-artboard.ts',
  },
  tests: [
    'modules/data-artboard/test/**/*.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: [
    'data-host-artboard',
    'host-api-bindable-artboards',
    'host-api-data-artboard',
    'components-host-artboard-reference',
  ],
  docs: ['modules/data-artboard/SPEC.md'],
};
