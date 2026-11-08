import './index.ts';
import { installPaintedBounds } from '../core/bounds.ts';
import type { a11y } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
installPaintedBounds((Icon.modules.get('a11y') as typeof a11y).runtime);
for (const icon of document.querySelectorAll<AnimaIcon>('anima-icon')) icon.invalidate();
