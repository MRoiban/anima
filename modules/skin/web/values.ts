import './index.ts';
import { installValues } from '../core/values.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';

(customElements.get('anima-icon') as typeof AnimaIcon).registerModule({
  name: 'skinvalues',
  after: ['skin'],
  entries: [],
  init(_registry, shared) {
    installValues(shared);
    return this;
  },
});
