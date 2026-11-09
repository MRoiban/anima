import './index.ts';
import { automatic } from '../core/auto.ts';
import type { SkinModule } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';

(customElements.get('anima-icon') as typeof AnimaIcon).registerModule({
  name: 'skinauto',
  after: ['skin'],
  entries: [],
  init(registry) {
    (registry.get('skin') as SkinModule).x![0] = automatic;
    return this;
  },
});
