import { mix } from '../core/index.ts';
import { mixSVG } from '../core/svg.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(mix);
(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend('mix', mixSVG);
