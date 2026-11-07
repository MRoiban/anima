// Browser authoring add-on. The lean compiler remains independently loadable.
import './index.ts';
import { paintMarkup, structuralMarkup } from '../../paint/markup/index.ts';
import { componentMarkup } from '../../components/markup/index.ts';
import { bindMarkup } from '../../bind/markup/index.ts';
import { converterCompiler } from '../../convert/markup/index.ts';
import { eventsMarkup } from '../../events/markup/index.ts';
import { motionMarkup } from '../../motion/markup/index.ts';
import { dataMarkup } from '../../data/markup/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';

const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
const { form, binding, rootChild, node } = dataMarkup;
// Match the former runtime registrations. Focus uses the complete structural engine;
// apply it after paint, regardless of the order in which runtime bundles arrive.
const hooks: [string, string, object][] = [
  ['components', 'components', componentMarkup],
  ['bind', 'bind', bindMarkup],
  ['convert', 'convert', converterCompiler],
  ['events', 'events', eventsMarkup],
  ['motion', 'motion', motionMarkup],
  ['data', 'data', { form, binding, rootChild, node }],
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
