// Component authoring, registered whether markup loads before or after this entry.
import { componentMarkup } from '@anima-format/markup/components';
import './index.ts';
import type { AnimaIcon } from './index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerMarkup(
  'components',
  componentMarkup,
);
