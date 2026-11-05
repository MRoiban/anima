import { bindMarkup } from '@anima-format/markup/bind';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerMarkup('bind', bindMarkup);
