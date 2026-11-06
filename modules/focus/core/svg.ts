import type { SVGBackend } from '../../../packages/core/src/svg.ts';
// Focus changes DOM semantics, not the renderer-neutral drawing.
export const focusSVG: SVGBackend = {};
