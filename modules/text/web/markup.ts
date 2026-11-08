import '../../../packages/web/src/markup.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import { structuralForms, paintMarkup } from '../../paint/markup/index.ts';
import { textMarkup } from '../markup/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerMarkup('paint', {
  ...Icon.markupHooks.paint,
  ...structuralForms,
  nodes: paintMarkup.nodes,
});
Icon.registerMarkup('text', textMarkup);
