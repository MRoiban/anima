// Registry-driven structural forms, also used by composite-only documents.
import { paintMarkup } from '@anima-format/markup/modules';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerMarkup('paint', paintMarkup);
