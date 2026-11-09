import './index.ts';
import { skinDash } from '../core/dash.ts';
import type { SkinModule } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';

(customElements.get('anima-icon') as typeof AnimaIcon).registerModule({
  name: 'skindash',
  after: ['skin'],
  entries: [],
  init(registry) {
    (registry.get('skin') as SkinModule).x![3] = true;
    return this;
  },
  draw: {
    frame(p, i, node, _entry, frame) {
      if (p.model.nodes[i]!.raw.skin) skinDash(i, node, frame);
    },
  },
});
