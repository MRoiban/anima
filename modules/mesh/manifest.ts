export const after = ['assets', 'bind'];
export default {
  name: 'mesh',
  after,
  core: { entry: 'core/index.ts', export: 'mesh', svg: 'core/svg.ts', svgExport: 'meshSVG' },
  web: [
    { name: 'mesh', budget: 1024, heavy: true },
    { name: 'canvas-mesh', budget: 768, over: 'canvas', heavy: true },
  ],
  adapters: {
    'packages/core/src/modules/mesh/index.ts': 'core/index.ts',
    'packages/core/src/modules/mesh/svg.ts': 'core/svg.ts',
    'packages/core/src/modules/mesh/static.ts': 'core/static.ts',
    'packages/web/src/mesh.ts': 'web/index.ts',
    'packages/web/src/canvas-mesh.ts': 'web/canvas.ts',
  },
  exports: {
    'core:./mesh': 'packages/core/src/modules/mesh/index.ts',
    'core:./mesh-svg': 'packages/core/src/modules/mesh/svg.ts',
    'core:./mesh-static': 'packages/core/src/modules/mesh/static.ts',
    'web:./mesh': 'packages/web/src/mesh.ts',
    'web:./canvas-mesh': 'packages/web/src/canvas-mesh.ts',
  },
  tests: [
    'modules/mesh/test/**/*.test.ts',
    'packages/markup/test/module-fields.test.ts',
    'packages/markup/test/compile.test.ts',
    'packages/markup/test/decompile.test.ts',
    'packages/markup/test/corpus.test.ts',
    'packages/markup/test/names.test.ts',
  ],
  conformance: ['rigging-mesh', 'rigging-mesh-animation'],
  docs: ['spec/SPEC.md'],
};
