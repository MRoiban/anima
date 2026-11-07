// Browser authoring add-on. The lean compiler remains independently loadable.
import './index.ts';
// seam(P6-4a): keep the complete authoring import installing base animation syntax.
import '../../markup-animation/web/index.ts';
import { paintMarkup, structuralMarkup } from '../../paint/markup/index.ts';
import { componentMarkup } from '../../components/markup/index.ts';
import { bindMarkup } from '../../bind/markup/index.ts';
import { converterCompiler } from '../../markup-hooks/markup/convert.ts';
import { eventsMarkup } from '../../markup-hooks/markup/events.ts';
import { motionMarkup } from '../../markup-hooks/markup/motion.ts';
import { dataMarkup } from '../../markup-hooks/markup/data.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';

const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
// Match the former runtime registrations. Focus uses the complete structural engine;
// apply it after paint, regardless of the order in which runtime bundles arrive.
const hooks: [string, string, object][] = [
  ['components', 'components', componentMarkup],
  ['bind', 'bind', bindMarkup],
  ['convert', 'convert', converterCompiler],
  ['events', 'events', eventsMarkup],
  ['motion', 'motion', motionMarkup],
  ['data', 'data', dataMarkup],
  ['paint', 'paint', paintMarkup],
  ['focus', 'paint', structuralMarkup],
];
function install(): void {
  for (const [module, slot, hook] of hooks)
    if (Icon.modules.has(module) && Icon.markupHooks[slot] !== hook)
      Icon.registerMarkup(slot, hook);
}
// Install eagerly for existing modules and synchronously for later arrivals, before a
// caller compiles AniML. The base runtime and compiler need no authoring dispatch code.
const register = Icon.registerModule;
Icon.registerModule = function (module) {
  register.call(this, module);
  install();
};
install();
export { compileAsync } from './index.ts';
