import { data } from '../core/index.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(data);

export { dataState } from '../core/index.ts';
