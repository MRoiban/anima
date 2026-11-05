// Optional AniML support (spec/ANIML.md §9). Import for its registration side effect.
import { compile } from '@anima-format/markup';
import './index.ts';
import type { AnimaIcon } from './index.ts';

// Also work when the base browser bundle was already loaded as a separate module.
(customElements.get('anima-icon') as typeof AnimaIcon).compiler = compile;
