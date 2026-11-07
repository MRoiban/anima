// Registration only: load beside markup, or use the complete markup-hooks entry.
import '@anima-format/web/markup';
import { animationMarkup } from '../markup/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerMarkup('animation', animationMarkup);
