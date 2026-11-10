import { scroll } from '../core/index.ts';
import { scrollSVG } from '../core/svg.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(scroll);
(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend('scroll', scrollSVG);
