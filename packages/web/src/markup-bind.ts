import { bindMarkup } from '@anima-format/markup/bind';
import './index.ts';
import type { AnimaIcon } from './index.ts';
(
  customElements.get('anima-icon') as typeof AnimaIcon & { markupBind?: typeof bindMarkup }
).markupBind = bindMarkup;
