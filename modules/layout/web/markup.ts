import { layoutMarkup } from '../markup/index.ts';
import '../../../packages/web/src/markup.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerMarkup('layout', layoutMarkup);
