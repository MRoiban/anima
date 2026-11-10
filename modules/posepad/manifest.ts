export const after = ['layout', 'rig'];
export default {
  ...{
    name: 'posepad',
    after: [],
    core: {
      entry: 'core/index.ts',
      export: 'posepad',
    },
    web: [
      // P3c reset rule: 772 B after the P8-5 tuple printer.
      { name: 'posepad', budget: 896, heavy: true },
      { name: 'posepad-handle', budget: 512, over: 'posepad', heavy: true },
    ],
    adapters: {
      'packages/core/src/modules/posepad/index.ts': 'core/index.ts',
      'packages/web/src/posepad.ts': 'web/index.ts',
      'packages/web/src/posepad-handle.ts': 'web/handle.ts',
    },
    exports: {
      'core:./posepad': 'packages/core/src/modules/posepad/index.ts',
      'web:./posepad': 'packages/web/src/posepad.ts',
      'web:./posepad-handle': 'packages/web/src/posepad-handle.ts',
    },
    tests: [
      'modules/posepad/test/**/*.test.ts',
      'packages/markup/test/corpus.test.ts',
      'packages/markup/test/names.test.ts',
      'packages/markup/test/compile.test.ts',
      'packages/markup/test/decompile.test.ts',
    ],
    conformance: [
      'rigging-joystick',
      'animation-joystick-two-axis',
      'animation-joystick-invert',
      'animation-joystick-handle',
    ],
    docs: ['spec/SPEC.md'],
  },
  after,
};
