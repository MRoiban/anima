// Authoring tools opt into the complete format. The base browser entry never imports this file.
import { VERBOSE } from './flags.ts';
import { registerModule } from './modules.ts';
import { paint } from './modules/paint/index.ts';
if (VERBOSE) registerModule(paint);
