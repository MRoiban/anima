import './index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import type { a11y } from '../core/index.ts';
import { installTextSemantics } from '../core/text.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
installTextSemantics((Icon.modules.get('a11y') as typeof a11y).runtime, Icon.modules);
for (const icon of document.querySelectorAll<AnimaIcon>('anima-icon'))
  icon.attributeChangedCallback('renderer', null, icon.getAttribute('renderer'));
