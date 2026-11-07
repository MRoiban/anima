// Registration only. The DOM overlay is implemented in P3b wave 2.
import { a11y } from '../core/index.ts';
import { a11yMarkup } from '../markup/index.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(a11y);
Icon.registerMarkup('paint', a11yMarkup);
