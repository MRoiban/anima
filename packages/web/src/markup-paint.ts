// Registry-driven structural forms, also used by composite-only documents.
import { paintMarkup } from '@anima-format/markup/modules';
import './index.ts';
import type { AnimaIcon } from './index.ts';
(
  customElements.get('anima-icon') as typeof AnimaIcon & {
    markupStructure?: typeof paintMarkup;
  }
).markupStructure = paintMarkup;
