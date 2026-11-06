import { data } from '../core/index.ts';
import { dataMarkup } from '../markup/index.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(data);
const { form, binding, rootChild, node } = dataMarkup;
Icon.registerMarkup('data', { form, binding, rootChild, node });
