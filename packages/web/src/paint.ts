// Optional browser module, including when the base runtime is already a separate bundle.
import { structuralMarkup } from '@anima-format/markup/modules';
import { paint } from '@anima-format/core/paint';
import './index.ts';
import type { AnimaIcon } from './index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(paint);
(customElements.get('anima-icon') as typeof AnimaIcon).markupModules = structuralMarkup;
