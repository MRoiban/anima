export const after = ['assets', 'bind'];
export default {
  name: 'mesh',
  summary:
    'Meshes: deform an image with a grid or explicit triangle mesh whose vertices can be animated or bound.',
  after,
  core: { entry: 'core/index.ts', export: 'mesh', svg: 'core/svg.ts', svgExport: 'meshSVG' },
  web: [
    // P3c reset rule after P8-5 (1,325 B measured; decided, owner may revisit).
    { name: 'mesh', budget: 1472, heavy: true },
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
