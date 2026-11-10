import './index.ts';
import { installOrigin } from '../core/origin.ts';
import type { RigModule } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';

(customElements.get('anima-icon') as typeof AnimaIcon).registerModule({
  name: 'rigorigin',
  after: ['rig', 'bind'],
  entries: [],
  init(registry) {
    installOrigin((registry.get('rig') as RigModule).origin, registry.get('bind'));
    return this;
  },
});
