// Authoring tools opt into the complete format. The base browser entry never imports this file.
import { VERBOSE } from './flags.ts';
import { registerModule } from './modules.ts';
import { componentsSVG } from './modules/components/svg.ts';
import { components } from './modules/components/index.ts';
import { bind } from './modules/bind/index.ts';
import { paint } from './modules/paint/index.ts';
import { composite } from './modules/composite/index.ts';
import { paintSVG } from './modules/paint/svg.ts';
import { compositeSVG } from './modules/composite/svg.ts';
import { registerSVGBackend } from './svg.ts';
import { assets } from './modules/assets/index.ts';
import { assetsSVG } from './modules/assets/svg.ts';
import { surface } from './modules/surface/index.ts';
import { surfaceSVG } from './modules/surface/svg.ts';
if (VERBOSE) {
  // Registered last: surface extends paints and already-resolved component drawings.
  registerModule(components);
  registerSVGBackend('components', componentsSVG);
  registerModule(bind);
  registerModule(assets);
  registerSVGBackend('assets', assetsSVG);
  registerModule(paint);
  registerModule(composite);
  registerSVGBackend('paint', paintSVG);
  registerSVGBackend('composite', compositeSVG);
  registerModule(surface);
  registerSVGBackend('surface', surfaceSVG);
}
