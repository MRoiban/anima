import { components } from '@anima-format/core/components';
import { componentsSVG } from '@anima-format/core/components-svg';
import './index.ts';
import type { AnimaIcon } from './index.ts';
(customElements.get('anima-icon') as typeof AnimaIcon).registerModule(components);
(customElements.get('anima-icon') as typeof AnimaIcon).registerSVGBackend(
  'components',
  componentsSVG,
);
