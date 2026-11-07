export const after = ['components', 'nested', 'lists', 'paint', 'surface', 'mix'];
export default {
  name: 'componentpaint',
  after,
  core: {
    entry: 'core/index.ts',
    export: 'componentpaint',
    svg: 'core/svg.ts',
    svgExport: 'componentpaintSVG',
  },
  web: [{ name: 'componentpaint', budget: 5120 }],
  adapters: {
    'packages/core/src/modules/componentpaint/index.ts': 'core/index.ts',
    'packages/core/src/modules/componentpaint/svg.ts': 'core/svg.ts',
    'packages/web/src/componentpaint.ts': 'web/index.ts',
  },
  exports: {
    'core:./componentpaint': 'packages/core/src/modules/componentpaint/index.ts',
    'web:./componentpaint': 'packages/web/src/componentpaint.ts',
  },
  tests: [
    'modules/componentpaint/test/**/*.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: ['drawing-paint-paint-artboard'],
  docs: ['modules/componentpaint/README.md'],
};
