// seam(P6-4a): register compiler-only hooks without the tooling decompiler.
import { converterCompiler } from '../../markup-hooks/markup/convert.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerMarkup('convert', converterCompiler);
