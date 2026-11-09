import type { Compiler } from '../../../packages/markup/src/compile.ts';
import { constraintElements } from '../markup/elements.ts';
import type { RigModule } from '../core/index.ts';
import { rigMarkup } from '../markup/index.ts';
import '../../../packages/web/src/markup.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerMarkup('paint', {
  ...Icon.markupHooks.paint,
  nodes: (c: Compiler) => Object.keys(c.elements).filter((k) => c.elements[k]!.target),
});
Icon.registerMarkup('text', Icon.markupHooks.text ?? rigMarkup);
Icon.registerModule({
  name: 'rigmarkup',
  after: ['rig'],
  entries: [],
  init(registry) {
    const kinds = (registry.get('rig') as RigModule | undefined)?.kinds ?? new Map();
    return {
      ...this,
      entries: [
        {
          target: 'node',
          shapes: {},
          get elements() {
            return constraintElements(kinds);
          },
        },
      ],
    };
  },
});
