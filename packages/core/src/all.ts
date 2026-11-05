// Authoring tools opt into the complete format. The base browser entry never imports this file.
import { VERBOSE } from './flags.ts';
import { registerModule } from './modules.ts';
import { bind } from './modules/bind/index.ts';
import { paint } from './modules/paint/index.ts';
import { composite } from './modules/composite/index.ts';
import { paintSVG } from './modules/paint/svg.ts';
import { compositeSVG } from './modules/composite/svg.ts';
import { registerSVGBackend } from './svg.ts';
if (VERBOSE) {
  registerModule(bind);
  registerModule(paint);
  registerModule(composite);
  registerSVGBackend('paint', paintSVG);
  registerSVGBackend('composite', compositeSVG);
}
