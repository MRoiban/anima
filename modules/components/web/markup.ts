// Component authoring, registered whether markup loads before or after this entry.
import { componentMarkup } from '@anima-format/markup/components';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerMarkup(
  'components',
  componentMarkup,
);
