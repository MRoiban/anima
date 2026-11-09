import { skin } from '../core/index.ts';
import { skinSVG } from '../core/svg.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(skin);
(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend('skin', skinSVG);
