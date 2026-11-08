import '../../markup/web/hooks.ts';
import { installArtboardMarkup } from '../markup/index.ts';
import { dataMarkup } from '../../markup-hooks/markup/data.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
installArtboardMarkup(dataMarkup);
(customElements.get('anima-icon') as typeof AnimaIcon).registerMarkup('data', dataMarkup);
