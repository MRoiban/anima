import './index.ts';
import { reflow, validateReflow } from '../core/reflow.ts';
import type { LayoutModule } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
const layout = Icon.modules.get('layout') as LayoutModule;
// A separately bundled second import keeps the installed reflow and its in-flight state.
layout.reflow ??= reflow;
layout.validateReflow ??= validateReflow;
