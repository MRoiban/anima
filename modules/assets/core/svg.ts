import type { SVGBackend, El } from '../../../packages/core/src/svg.ts';
import { fmt } from '../../../packages/core/src/draw.ts';

export const assetsSVG: SVGBackend = {
  tree(draw, tree) {
    const visit = (els: El[]) => {
      for (const el of els) {
        if (el.role === 'shape' && draw.nodes[el.node]!.kind === 'image') {
          el.tag = 'svg';
          el.role = 'module:image-box';
          el.kids = [{ tag: 'image', role: 'module:image', node: el.node, kids: [] }];
        } else visit(el.kids);
      }
    };
    visit(tree.root);
  },
  attrs(f, el, _paint, _id, a) {
    if (!el.role.startsWith('module:image')) return;
    // seam(P7-7): a cleared external instance retires slots before the retained DOM refresh.
    const g = f.nodes[el.node]?.geometry;
    if (!g?.image) return;
    const image = g.image;
    const w = g.width!,
      h = g.height!;
    if (el.role === 'module:image-box') {
      Object.assign(a, {
        x: fmt(g.x!),
        y: fmt(g.y!),
        width: fmt(w),
        height: fmt(h),
        viewBox: `0 0 ${fmt(w)} ${fmt(h)}`,
        overflow: 'hidden',
        preserveAspectRatio: 'none',
      });
      return;
    }
    const iw = image.width ?? w,
      ih = image.height ?? h;
    const sx = w / iw,
      sy = h / ih;
    const scale =
      image.fit === 'cover'
        ? Math.max(sx, sy)
        : image.fit === 'none'
          ? 1
          : image.fit === 'scale-down'
            ? Math.min(1, sx, sy)
            : image.fit === 'fit-width'
              ? sx
              : image.fit === 'fit-height'
                ? sy
                : Math.min(sx, sy);
    const fill = image.fit === 'fill' || image.fit === 'resize';
    const dw = fill ? w : iw * scale,
      dh = fill ? h : ih * scale;
    const factor = (lo: string, hi: string) =>
      image.align.includes(lo) ? 0 : image.align.includes(hi) ? 1 : 0.5;
    Object.assign(a, {
      href: image.source,
      x: fmt((w - dw) * factor('left', 'right')),
      y: fmt((h - dh) * factor('top', 'bottom')),
      width: fmt(dw),
      height: fmt(dh),
      preserveAspectRatio: 'none',
      'image-rendering': image.sampling === 'nearest' ? 'pixelated' : 'auto',
    });
  },
};
