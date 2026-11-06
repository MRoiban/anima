export const after = ['bind'];
export default {
  name: 'convert',
  after,
  core: { entry: 'core/index.ts', export: 'convert' },
  web: [
    { name: 'convert', budget: 8192 },
    { name: 'markup-convert', budget: 2048, over: 'index' },
  ],
  markupHook: {
    slot: 'convertCompiler',
    type: 'converterCompiler',
    value: 'converterCompiler',
    browserName: 'convert',
  },
  adapters: {
    'packages/core/src/modules/convert/index.ts': 'core/index.ts',
    'packages/markup/src/convert.ts': 'markup/index.ts',
    'packages/web/src/convert.ts': 'web/index.ts',
    'packages/web/src/markup-convert.ts': 'web/markup.ts',
  },
  exports: {
    'core:./convert': 'packages/core/src/modules/convert/index.ts',
    'markup:./convert': 'packages/markup/src/convert.ts',
    'web:./convert': 'packages/web/src/convert.ts',
    'web:./markup-convert': 'packages/web/src/markup-convert.ts',
  },
  tests: [
    'modules/convert/test/**/*.test.ts',
    'packages/markup/test/compile.test.ts',
    'packages/markup/test/decompile.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: [
    'data-converter-',
    'data-calculate-',
    'data-formula-',
    'data-range-',
    'data-trim-',
    'data-pad-',
    'data-template-',
    'data-interpolate-',
  ],
  docs: ['modules/convert/SPEC.md'],
};
