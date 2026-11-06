import './index.ts';
import { paintSVG } from '@anima-format/core/paint-svg';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend('paint', paintSVG);
