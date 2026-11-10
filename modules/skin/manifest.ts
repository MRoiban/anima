export const after = ['contour', 'mesh', 'paint', 'rig'];
export default {
  name: 'skin',
  summary:
    'Skinning: deform paths, contours and meshes from bones with explicit or automatic weights.',
  after,
  core: { entry: 'core/all.ts', export: 'skin', svg: 'core/svg.ts', svgExport: 'skinSVG' },
  web: [
    { name: 'skin', budget: 1536, heavy: true },
    { name: 'skin-auto', budget: 320, over: 'skin', heavy: true },
    { name: 'skin-dash', budget: 192, over: 'skin', heavy: true },
    { name: 'skin-mesh', budget: 256, over: 'skin', heavy: true },
    { name: 'skin-values', budget: 256, over: 'skin', heavy: true },
  ],
  adapters: {
    'packages/core/src/modules/skin/index.ts': 'core/all.ts',
    'packages/core/src/modules/skin/svg.ts': 'core/svg.ts',
    'packages/markup/src/skin.ts': 'markup/index.ts',
    'packages/web/src/skin.ts': 'web/index.ts',
    'packages/web/src/skin-auto.ts': 'web/auto.ts',
    'packages/web/src/skin-dash.ts': 'web/dash.ts',
    'packages/web/src/skin-mesh.ts': 'web/mesh.ts',
    'packages/web/src/skin-values.ts': 'web/values.ts',
  },
  exports: {
    'core:./skin': 'packages/core/src/modules/skin/index.ts',
    'markup:./skin': 'packages/markup/src/skin.ts',
    'web:./skin': 'packages/web/src/skin.ts',
    'web:./skin-auto': 'packages/web/src/skin-auto.ts',
    'web:./skin-dash': 'packages/web/src/skin-dash.ts',
    'web:./skin-mesh': 'packages/web/src/skin-mesh.ts',
    'web:./skin-values': 'packages/web/src/skin-values.ts',
  },
  tests: [
    'modules/skin/test/**/*.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: ['rigging-skin', 'rigging-weights', 'rigging-cubic-weights'],
  docs: ['spec/SPEC.md'],
};
