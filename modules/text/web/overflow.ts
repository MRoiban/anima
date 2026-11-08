import './index.ts';
import { overflowText } from '../core/overflow.ts';
import type { TextModule } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
(Icon.modules.get('text') as TextModule).overflow = overflowText;
