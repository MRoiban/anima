import { machine } from '../core/index.ts';
import { machineSVG } from '../core/svg.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(machine);
(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend('machine', machineSVG);
