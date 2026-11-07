// Optional surface module; existing web entries remain independent.
import { surface } from '@anima-format/core/surface';
import { surfaceSVG } from '@anima-format/core/surface-svg';
import '../../paint/web/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(surface);
(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend('surface', surfaceSVG);
