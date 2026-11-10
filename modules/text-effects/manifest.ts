export const after = ['text'];
export default {
  ...{
    name: 'text-effects',
    summary:
      'Text effects: per-character modifiers (offset, opacity, follow path) over animated ranges.',
    core: {
      entry: 'core/index.ts',
      export: 'textEffects',
      svg: 'core/svg.ts',
      svgExport: 'textEffectsSVG',
    },
    web: [
      { name: 'text-effects', budget: 4096, over: 'text' },
      { name: 'markup-text-effects', budget: 256, over: 'markup-text', authoring: true },
    ],
    adapters: {
      'packages/core/src/modules/text-effects/index.ts': 'core/index.ts',
      'packages/core/src/modules/text-effects/svg.ts': 'core/svg.ts',
      'packages/markup/src/text-effects.ts': 'markup/index.ts',
      'packages/web/src/text-effects.ts': 'web/index.ts',
      'packages/web/src/texteffects.ts': 'web/index.ts',
      'packages/web/src/markup-text-effects.ts': 'web/markup.ts',
    },
    exports: {
      'core:./text-effects': 'packages/core/src/modules/text-effects/index.ts',
      'markup:./text-effects': 'packages/markup/src/text-effects.ts',
      'web:./text-effects': 'packages/web/src/text-effects.ts',
      'web:./texteffects': 'packages/web/src/texteffects.ts',
      'web:./markup-text-effects': 'packages/web/src/markup-text-effects.ts',
    },
    tests: [
      'modules/text-effects/test/**/*.test.ts',
      'packages/markup/test/corpus.test.ts',
      'packages/markup/test/names.test.ts',
      'packages/markup/test/compile.test.ts',
      'packages/markup/test/decompile.test.ts',
    ],
    conformance: [
      'text-modifier-translation',
      'text-modifier-rotation',
      'text-modifier-scale',
      'text-modifier-opacity',
      'text-modifier-origin',
      'text-modifier-variation',
      'text-modifier-follow-path',
      'text-range-units',
      'text-range-falloff',
      'text-range-easing',
      'text-range-combine',
      'text-range-run',
      'text-background',
      'text-script-direction',
    ],
    docs: ['spec/SPEC.md', 'modules/text-effects/SPEC.md'],
  },
  after,
};
