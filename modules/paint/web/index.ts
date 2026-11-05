import './markup.ts';
// Optional browser module, including when the base runtime is already a separate bundle.
import { paintSVG } from '@anima-format/core/paint-svg';
import { paint } from '@anima-format/core/paint';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(paint);

(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend('paint', paintSVG);
