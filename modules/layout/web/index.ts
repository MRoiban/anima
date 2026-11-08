import { layout } from '../core/index.ts';
import { layoutSVG } from '../core/svg.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(layout);
(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend('layout', layoutSVG);
