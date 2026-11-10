export const after = ['components', 'data', 'bind', 'convert', 'derive'];
export default {
  ...{
    name: 'lists',
    summary:
      'Lists: repeat a component for each item of a data list, keeping each row’s state across edits.',
    after: [],
    core: { entry: 'core/index.ts', export: 'lists', svg: 'core/svg.ts', svgExport: 'listsSVG' },
    web: [{ name: 'lists', budget: 5696 }],
    adapters: {
      'packages/core/src/modules/lists/index.ts': 'core/index.ts',
      'packages/core/src/modules/lists/svg.ts': 'core/svg.ts',
      'packages/markup/src/lists.ts': 'markup/index.ts',
      'packages/web/src/lists.ts': 'web/index.ts',
    },
    exports: {
      'core:./lists': 'packages/core/src/modules/lists/index.ts',
      'markup:./lists': 'packages/markup/src/lists.ts',
      'web:./lists': 'packages/web/src/lists.ts',
    },
    tests: [
      'modules/lists/test/**/*.test.ts',
      'packages/markup/test/corpus.test.ts',
      'packages/markup/test/names.test.ts',
      'packages/markup/test/compile.test.ts',
      'packages/markup/test/decompile.test.ts',
      'packages/cli/test/authoring.test.ts',
    ],
    conformance: [
      'lists-',
      'components-list',
      'components-list-map',
      'components-list-size-override',
      'components-explicit-context',
      'components-inherited-context',
      'data-binding-relative',
      'data-property-symbol-list-index',
      'data-converter-number-to-list',
    ],
    docs: ['modules/lists/SPEC.md'],
  },
  after,
};
