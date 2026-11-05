export * from './load.ts';
export { registerModule, modules, type Module, type ModuleEntry } from './modules.ts';
export type { Diagnostic } from './diag.ts';
export { parsePath, selectPath, flatten, formatSegs, PathError, type Subpath } from './path.ts';
export { parseEase, cubic, elastic, type EaseFn } from './ease.ts';
export { parseHex, formatHex, lerpColor, type RGBA } from './color.ts';
export { parseCondition, type Term } from './cond.ts';
export {
  Player,
  sampleTrack,
  type AnimaEvent,
  type LayerInspect,
  type StepResult,
  type PointerKind,
} from './player.ts';
export { runScript, ScriptError, type Snapshot } from './script.ts';
export { localMatrix, mul, invert, apply, IDENTITY, type Mat } from './geom.ts';
export {
  sceneTree,
  sceneOrder,
  attrs,
  svgAttrs,
  toSVG,
  cssSlots,
  staticSlots,
  type El,
  type Attrs,
  type Paint,
} from './svg.ts';
export * from './registry.ts';
export { jsonSchema } from './schema.ts';
export { VERBOSE } from './flags.ts';
export { formatAni } from './format.ts';
export { suggest, ptr } from './diag.ts';

export * from './draw.ts';
export { registerSVGBackend, svgBackends, type SVGBackend } from './svg.ts';
