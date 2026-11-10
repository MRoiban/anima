export const after = ['paint', 'composite'];
export default {
  ...{
    name: 'contour',
    summary:
      'Contours: shapes built from straight, smooth and rounded vertices, with path operations.',
    after: [],
    core: {
      entry: 'core/index.ts',
      export: 'contour',
      svg: 'core/svg.ts',
      svgExport: 'contourSVG',
    },
    web: [{ name: 'contour', budget: 3840 }],
    adapters: {
      'packages/core/src/modules/contour/index.ts': 'core/index.ts',
      'packages/core/src/modules/contour/svg.ts': 'core/svg.ts',
      'packages/markup/src/contour.ts': 'markup/index.ts',
      'packages/web/src/contour.ts': 'web/index.ts',
    },
    exports: {
      'core:./contour': 'packages/core/src/modules/contour/index.ts',
      'markup:./contour': 'packages/markup/src/contour.ts',
      'web:./contour': 'packages/web/src/contour.ts',
    },
    tests: [
      'modules/contour/test/**/*.test.ts',
      'packages/markup/test/corpus.test.ts',
      'packages/markup/test/names.test.ts',
    ],
    conformance: [
      'drawing-paint-straight-vertex',
      'drawing-paint-mirrored-vertex',
      'drawing-paint-asymmetric-vertex',
      'drawing-paint-detached-vertex',
      'drawing-paint-rounded-vertex',
      'drawing-paint-geometry-origin',
      'drawing-paint-trim-sequential',
      'drawing-paint-trim-synchronized',
      'drawing-paint-effect-order',
      'drawing-paint-shared-effects',
      'drawing-paint-fill-rule-clockwise',
    ],
    docs: ['spec/SPEC.md'],
  },
  after,
};
