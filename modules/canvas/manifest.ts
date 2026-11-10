export const after: string[] = [];
export default {
  name: 'canvas',
  summary: 'Browser entry: a Canvas2D renderer backend (high-DPI) for heavy scenes such as meshes.',
  after,
  web: [{ name: 'canvas', budget: 5888, heavy: true }],
  adapters: { 'packages/web/src/canvas.ts': 'web/index.ts' },
  exports: { 'web:./canvas': 'packages/web/src/canvas.ts' },
  tests: ['modules/canvas/test/**/*.test.ts', 'packages/markup/test/corpus.test.ts'],
  conformance: [
    'host-api-device-pixel-ratio',
    'host-api-resize-backing-surface',
    'platforms-web-canvas',
  ],
  docs: ['spec/SPEC.md', 'spec/MODULES.md', 'docs/WEB.md', 'docs/AUTHORING.md'],
};
