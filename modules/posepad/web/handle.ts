import './index.ts';
import { handles } from '../core/handle.ts';
import type { PosePadModule } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
(Icon.modules.get('posepad') as PosePadModule).handles ??= handles;
