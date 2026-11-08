import type { SVGBackend } from '../../../packages/core/src/svg.ts';
import type { TextDrawNode } from '../../text/core/index.ts';
import { cssFont } from './css.ts';
export const fontsSVG: SVGBackend = {
  attrs(frame, el, _paint, _id, attrs) {
    if (el.role !== 'module:text-run') return;
    const c = (frame.nodes[el.node] as TextDrawNode).text?.layout.lines[el.index!]?.clusters[
      +el.key!
    ];
    if (!c) return;
    const css = cssFont(c.font);
    attrs.style = `font-variation-settings:${css.fontVariationSettings};font-feature-settings:${css.fontFeatureSettings}`;
  },
};
