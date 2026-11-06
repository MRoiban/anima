import type { SVGBackend } from '../../../packages/core/src/svg.ts';
export class UnsupportedMixRenderError extends Error {
  readonly code = 'unsupported-render';
  readonly hint = 'use the canvas renderer for this compositing mode';
  readonly pointer: string;
  constructor(pointer: string, feature = 'additive blending') {
    super(`SVG cannot faithfully render ${feature} across supported renderers`);
    this.pointer = pointer;
  }
}
export const mixSVG: SVGBackend = {
  attrs(frame, el) {
    const n = frame.nodes[el.node]!;
    const pointer = frame.tree.nodes[el.node]!.pointer ?? `/nodes/${el.node}`;
    if (n.blend === 'additive' || n.paints.some((p) => p.blend === 'additive'))
      throw new UnsupportedMixRenderError(`${pointer}/mix`);
    const paint = n.paints.find((p) => p.blend && p.blend !== 'normal');
    if (paint)
      throw new UnsupportedMixRenderError(
        `${pointer}/${(paint.key ?? paint.kind).replaceAll('.', '/')}/blend`,
        'per-paint blend overrides (nested SVG blending differs in Firefox)',
      );
  },
};
