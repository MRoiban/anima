import { layout } from '../core/index.ts';
import './svg.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(layout);
