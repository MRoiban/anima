export const after = ['contour', 'mesh', 'paint', 'rig'];
export default {
  name: 'skin',
  after,
  core: { entry: 'core/index.ts', export: 'skin', svg: 'core/svg.ts', svgExport: 'skinSVG' },
  web: [{ name: 'skin', budget: 1536, heavy: true }],
  adapters: {
    'packages/core/src/modules/skin/index.ts': 'core/index.ts',
    'packages/core/src/modules/skin/svg.ts': 'core/svg.ts',
    'packages/markup/src/skin.ts': 'markup/index.ts',
    'packages/web/src/skin.ts': 'web/index.ts',
  },
  exports: {
    'core:./skin': 'packages/core/src/modules/skin/index.ts',
    'markup:./skin': 'packages/markup/src/skin.ts',
    'web:./skin': 'packages/web/src/skin.ts',
  },
  tests: [
    'modules/skin/test/**/*.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: ['rigging-skin', 'rigging-weights', 'rigging-cubic-weights'],
  docs: ['spec/SPEC.md'],
};
