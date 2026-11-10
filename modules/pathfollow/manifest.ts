export const after = ['rig', 'lists', 'contour'];
export default {
  ...{
    name: 'pathfollow',
    summary: 'Follow path: place or orient nodes along a path outline, with offsets and spreading.',
    after: [],
    core: {
      entry: 'core/index.ts',
      export: 'pathfollow',
      svg: 'core/svg.ts',
      svgExport: 'pathfollowSVG',
    },
    web: [{ name: 'pathfollow', budget: 1280, heavy: true, over: 'rig' }],
    adapters: {
      'packages/core/src/modules/pathfollow/index.ts': 'core/index.ts',
      'packages/core/src/modules/pathfollow/svg.ts': 'core/svg.ts',
      'packages/markup/src/pathfollow.ts': 'markup/index.ts',
      'packages/web/src/pathfollow.ts': 'web/index.ts',
    },
    exports: {
      'core:./pathfollow': 'packages/core/src/modules/pathfollow/index.ts',
      'markup:./pathfollow': 'packages/markup/src/pathfollow.ts',
      'web:./pathfollow': 'packages/web/src/pathfollow.ts',
    },
    tests: [
      'modules/pathfollow/test/**/*.test.ts',
      'packages/markup/test/corpus.test.ts',
      'packages/markup/test/names.test.ts',
      'packages/markup/test/decompile.test.ts',
    ],
    conformance: ['rigging-follow-path', 'rigging-list-follow-path'],
    docs: ['spec/SPEC.md'],
  },
  after,
};
