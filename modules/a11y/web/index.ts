// Registration only. The DOM overlay is implemented in P3b wave 2. In-browser AniML: markup-a11y.
import { a11y } from '../core/index.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(a11y);
