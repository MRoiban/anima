import { rig } from '../core/index.ts';
import { rigSVG } from '../core/svg.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(rig);
(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend('rig', rigSVG);
