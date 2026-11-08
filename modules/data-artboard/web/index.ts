import '../../nested/web/index.ts';
import { dataArtboard, component } from '../core/index.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(dataArtboard);
Icon.prototype.component = component;
declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    component: typeof component;
  }
}
