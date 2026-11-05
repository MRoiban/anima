// Optional binding evaluator; registration uses the base runtime's shared module registry.
import { bind } from '@anima-format/core/bind';
import './index.ts';
import type { AnimaIcon } from './index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(bind);
