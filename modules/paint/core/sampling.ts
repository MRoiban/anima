import type { ImageResource } from '../../assets/core/index.ts';
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
              kids: Array.from({ length: 9 }, (_, key) => ({
                tag: 'svg',
                role: 'sample:crop',
                node: el.node,
                index: key,
                kids: [{ tag: 'image', role: 'sample:source', node: el.node, kids: [] }],
              })),
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
      r = g.image! as ImageResource;
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
    if (
      r.sampling === 'bilinear' &&
      ((r.wrapX === 'clamp' && (x > 0 || x + w < g.width!)) ||
        (r.wrapY === 'clamp' && (y > 0 || y + h < g.height!)))
    )
      throw Object.assign(
        new Error('SVG cannot isolate clamped edge texels before bilinear filtering'),
        {
          code: 'unsupported-render',
          pointer: (f.tree.nodes[el.node]!.pointer ?? '/nodes/' + el.node) + '/sampling',
          hint: 'use sampling="nearest" or the canvas renderer for bilinear clamp extension',
        },
      );
    if (el.role === 'sample:source') {
      Object.assign(a, image, { x: '0', y: '0' });
      return;
    }
    const wx = r.wrapX!,
      wy = r.wrapY!;
    const tx = wx === 'clamp' ? 0 : x,
      ty = wy === 'clamp' ? 0 : y;
    const mx = wx === 'mirror',
      my = wy === 'mirror',
      key = `${id}tile${el.node}`;
    if (el.role === 'sample:crop') {
      const axis = (
        n: number,
        pos: number,
        size: number,
        box: number,
        pixels: number,
        mode: string,
      ) => {
        const edge = size / pixels;
        return n === 1
          ? [pos, size, 0, size]
          : n === 0
            ? [0, mode === 'clamp' ? Math.max(0, pos) : 0, 0, edge]
            : [pos + size, mode === 'clamp' ? Math.max(0, box - pos - size) : 0, size - edge, edge];
      };
      const [dx, dw, sx, sw] = axis(
          el.index! % 3,
          x,
          w,
          g.width!,
          (r.pixels?.[0] ?? r.width ?? g.width)!,
          wx,
        ),
        [dy, dh, sy, sh] = axis(
          Math.floor(el.index! / 3),
          y,
          h,
          g.height!,
          (r.pixels?.[1] ?? r.height ?? g.height)!,
          wy,
        );
      Object.assign(a, {
        x: String(dx),
        y: String(dy),
        width: String(dw),
        height: String(dh),
        viewBox: `${sx} ${sy} ${sw} ${sh}`,
        display: dw && dh ? 'inline' : 'none',
        style: `width:${dw}px;height:${dh}px;overflow:hidden`,
        preserveAspectRatio: 'none',
        overflow: 'hidden',
      });
    } else if (el.role === 'sample:rect')
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
