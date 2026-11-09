import { ik } from '../core/index.ts';
import { ikSVG } from '../core/svg.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(ik);
(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend('ik', ikSVG);
