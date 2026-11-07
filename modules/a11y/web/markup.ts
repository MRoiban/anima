// Registry-driven structural forms for in-browser AniML (`<a11y …/>` children), as markup-paint does.
// Pages that load compiled `.ani` need only `@anima-format/web/a11y`.
import { a11yMarkup } from '../markup/index.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerMarkup('paint', a11yMarkup);
