import './index.ts';
import { registerDistance } from '../core/distance.ts';
import type { RigModule } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule({
  name: 'rigdistance',
  after: ['rig'],
  entries: [],
  init(registry) {
    registerDistance((registry.get('rig') as RigModule).registerConstraint);
    return this;
  },
});
