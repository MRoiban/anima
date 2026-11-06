import type { ModuleEntry } from '../../../packages/core/src/modules.ts';
import type { SVGBackend, El } from '../../../packages/core/src/svg.ts';
// Patterns handle either browser backend registration order.
const wrap = { k: 'str' as const, of: ['clamp', 'repeat', 'mirror'] };
export const samplingEntries: ModuleEntry[] = [
  {
    target: 'image',
    shapes: {
      wrap,
      wrapX: { ...wrap, markup: 'wrap-x' },
      wrapY: { ...wrap, markup: 'wrap-y' },
    },
  },
];
export const samplingSVG: SVGBackend = {
  tree(draw, tree) {
    const visit = (els: El[]) => {
      for (const el of els) {
        if (
          draw.nodes[el.node]!.imageWrap &&
          (el.role === 'shape' || el.role === 'module:image-box')
        ) {
          el.tag = 'svg';
          el.role = 'module:image-box';
          el.kids = [{ tag: 'rect', role: 'sample:rect', node: el.node, kids: [] }];
          tree.defs.push({
            tag: 'pattern',
            role: 'sample:pattern',
            node: el.node,
            kids: [0, 1, 2, 3].map((index) => ({
              tag: 'g',
              role: 'sample:flip',
              node: el.node,
              index,
              kids: [{ tag: 'image', role: 'module:image', node: el.node, kids: [] }],
            })),
          });
        } else visit(el.kids);
      }
    };
    visit(tree.root);
  },
  attrs(f, el, paint, id, a, render) {
    if (!el.role.startsWith('sample:')) return;
    const g = f.nodes[el.node]!.geometry!,
      r = g.image!;
    if (r.sampling === 'bilinear' && (r.wrapX === 'repeat' || r.wrapY === 'repeat'))
      throw Object.assign(new Error('SVG patterns cannot filter across repeated texture edges'), {
        code: 'unsupported-render',
        pointer:
          (f.tree.nodes[el.node]!.pointer ?? '/nodes/' + el.node) +
          (r.wrap !== undefined ? '/wrap' : r.wrapX === 'repeat' ? '/wrapX' : '/wrapY'),
        hint: 'use sampling="nearest" or canvas; native delta 188, 36852/57600 pixels >16',
      });
    const image = render(f, { ...el, role: 'module:image' }, paint, id);
    const w = +image.width!,
      h = +image.height!,
      x = +image.x!,
      y = +image.y!;
    const wx = r.wrapX!,
      wy = r.wrapY!;
    const tx = wx === 'clamp' ? 0 : x,
      ty = wy === 'clamp' ? 0 : y;
    const mx = wx === 'mirror',
      my = wy === 'mirror',
      key = `${id}tile${el.node}`;
    if (el.role === 'sample:rect')
      Object.assign(a, { width: String(g.width), height: String(g.height), fill: `url(#${key})` });
    else if (el.role === 'sample:pattern')
      Object.assign(a, {
        id: key,
        patternUnits: 'userSpaceOnUse',
        x: String(tx),
        y: String(ty),
        width: String(wx === 'clamp' ? g.width : w * (mx ? 2 : 1)),
        height: String(wy === 'clamp' ? g.height : h * (my ? 2 : 1)),
      });
    else {
      const fx = el.index! & 1,
        fy = el.index! >> 1;
      Object.assign(a, {
        display: (fx && !mx) || (fy && !my) ? 'none' : 'inline',
        transform: `matrix(${fx ? -1 : 1} 0 0 ${fy ? -1 : 1} ${fx ? 2 * w + tx : -tx} ${fy ? 2 * h + ty : -ty})`,
      });
    }
  },
};
