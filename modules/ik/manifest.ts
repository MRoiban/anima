// TODO: review dependencies and measured budget before implementation.
export const after: string[] = ['rig'];
export default {
  ...{
    name: 'ik',
    after: [],
    core: { entry: 'core/index.ts', export: 'ik', svg: 'core/svg.ts', svgExport: 'ikSVG' },
    web: [{ name: 'ik', budget: 896, heavy: true, over: 'rig' }],
    adapters: {
      'packages/core/src/modules/ik/index.ts': 'core/index.ts',
      'packages/core/src/modules/ik/svg.ts': 'core/svg.ts',
      'packages/markup/src/ik.ts': 'markup/index.ts',
      'packages/web/src/ik.ts': 'web/index.ts',
    },
    exports: {
      'core:./ik': 'packages/core/src/modules/ik/index.ts',
      'markup:./ik': 'packages/markup/src/ik.ts',
      'web:./ik': 'packages/web/src/ik.ts',
    },
    tests: [
      'modules/ik/test/**/*.test.ts',
      'packages/markup/test/corpus.test.ts',
      'packages/markup/test/names.test.ts',
    ],
    conformance: ['rigging-ik', 'rigging-ik-bend'],
    docs: ['spec/SPEC.md'],
  },
  after,
};
