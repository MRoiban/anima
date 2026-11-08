import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import { layoutSVG } from '../core/svg.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend('layout', layoutSVG);
