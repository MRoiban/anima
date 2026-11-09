import type { SVGBackend } from '../../../packages/core/src/svg.ts';
import { paintColor } from '../../../packages/core/src/svg.ts';
import { fmt } from '../../../packages/core/src/draw.ts';
import { parseHex } from '../../../packages/core/src/color.ts';
import { mixColor } from './index.ts';
export const colormixSVG: SVGBackend = {
  attrs(f, el, slots, _id, a) {
    // Mask/clip construction uses synthetic white and black paints, not the node colour.
    if (
      el.role !== 'shape' &&
      !(el.role === 'module:composite' && ['fill-only', 'stroke-only'].includes(el.key!))
    )
      return;
    const paints = f.nodes[el.node]!.paints;
    for (const paint of paints) {
      if (!paint.mix || a[paint.kind] === 'none') continue;
      const { a: x, b: y, t } = paint.mix,
        c = paintColor(x, slots),
        d = paintColor(y, slots);
      a[paint.kind] =
        parseHex(c) && parseHex(d)
          ? mixColor(c, d, t)
          : `color-mix(in srgb, ${c}, ${d} ${fmt(t * 100)}%)`;
    }
  },
};
