import { pathfollow } from '../core/index.ts';
import { pathfollowSVG } from '../core/svg.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(pathfollow);
(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend(
  'pathfollow',
  pathfollowSVG,
);
