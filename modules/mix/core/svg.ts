import type { SVGBackend, El } from '../../../packages/core/src/svg.ts';
import { fmt } from '../../../packages/core/src/draw.ts';
export class UnsupportedMixRenderError extends Error {
  readonly code = 'unsupported-render';
  readonly hint = 'use the canvas renderer for this compositing mode';
  readonly pointer: string;
  constructor(pointer: string, feature = 'additive blending') {
    super(`SVG cannot faithfully render ${feature} across supported renderers`);
    this.pointer = pointer;
  }
}
const group = (role: string, el: El, kids: El[], index?: number): El => ({
  tag: 'g',
  role: 'module:mix-' + role,
  node: el.node,
  kids,
  index,
});
export const mixSVG: SVGBackend = {
  tree(draw, tree) {
    if (!draw.resources.some((r) => r.kind === 'mix-paints')) return;
    const visit = (els: El[], clips: El[] = []) => {
      for (let j = 0; j < els.length; j++) {
        const el = els[j]!;
        const active =
          el.role === 'module:composite' && ['clip-wrap', 'position-wrap'].includes(el.key!)
            ? [
                ...clips,
                {
                  ...el,
                  key: el.key === 'clip-wrap' ? 'clip' : 'position',
                  tag:
                    el.key === 'position-wrap' && draw.nodes[el.node]!.position === 'outside'
                      ? 'mask'
                      : 'clip-path',
                },
              ]
            : clips;
        const image = el.role === 'module:image-box';
        if (el.role === 'module:surface' && el.key === 'source') continue;
        if (!image) visit(el.kids, active);
        const leaf =
          image ||
          (!el.kids.length &&
            (el.role === 'shape' ||
              el.role === 'module:contour' ||
              (el.role === 'module:composite' &&
                ['paint', 'stroke-only', 'fill-only', 'outline', 'black'].includes(el.key!)) ||
              (el.role === 'module:surface' &&
                (el.key?.startsWith('leaf:') || el.key === 'patch'))));
        if (!leaf) continue;
        // Split the ordinary combined fill/stroke leaf; ordered paints already have one leaf each.
        const paints = el.role === 'shape' ? ['fill', 'stroke'] : [undefined];
        const children = paints.map((paint) => {
          const child = paint ? { ...el, role: 'module:mix-paint', key: paint } : el;
          const at = el.role === 'module:composite' && el.key === 'paint' ? el.index : undefined;
          const key =
            paint ??
            (el.key === 'stroke-only'
              ? 'stroke'
              : el.key === 'fill-only'
                ? 'fill'
                : el.key?.startsWith('leaf:')
                  ? el.key.slice(5)
                  : el.key);
          let inner = group('transform', el, [child]);
          for (const clip of active)
            inner = {
              ...group('clip', clip, [inner]),
              key: clip.key,
              tag: 'g',
              index: clip.tag === 'mask' ? 1 : 0,
            };
          const wrapper = group('blend', el, [inner], at);
          wrapper.key = key;
          return wrapper;
        });
        els.splice(j, 1, ...children);
        j += children.length - 1;
      }
    };
    visit(tree.root);
    visit(tree.defs);
  },
  attrs(frame, el, paint, id, attrs, render) {
    const n = frame.nodes[el.node]!;
    const pointer = frame.tree.nodes[el.node]!.pointer ?? `/nodes/${el.node}`;
    if (n.blend === 'additive') throw new UnsupportedMixRenderError(`${pointer}/mix`);
    const additivePaint = n.paints.find((p) => p.blend === 'additive');
    if (additivePaint)
      throw new UnsupportedMixRenderError(
        `${pointer}/${(additivePaint.key ?? additivePaint.kind).replaceAll('.', '/')}`,
        'additive paint blending',
      );
    if (!frame.tree.resources.some((r) => r.kind === 'mix-paints')) return;
    // A transformed SVG group incorrectly isolates descendant blend modes in Firefox.
    // Keep compositing groups, but move all geometry to world-space transform wrappers.
    if (el.role === 'node') attrs.transform = null;
    if (el.role === 'cutg' || el.role === 'module:mix-transform')
      attrs.transform = `matrix(${n.world!.map(fmt).join(' ')})`;
    if (el.role === 'module:mix-clip')
      attrs[el.index ? 'mask' : 'clip-path'] = `url(#${id}c${el.node}-${el.key})`;
    if (el.role === 'module:mix-blend')
      attrs.style = `mix-blend-mode:${(el.index === undefined ? n.paints.find((p) => p.kind === el.key) : n.paints[el.index])?.blend ?? 'normal'}`;
    if (el.role === 'module:mix-paint') {
      const nodes = frame.nodes.slice(),
        selected = n.paints.find((p) => p.kind === el.key);
      if (!selected) {
        attrs.display = 'none';
        return;
      }
      nodes[el.node] = { ...n, paints: [selected] };
      Object.assign(attrs, render({ ...frame, nodes }, { ...el, role: 'shape' }, paint, id));
      attrs[selected.kind === 'fill' ? 'stroke' : 'fill'] = 'none';
    }
    if (el.role === 'module:composite') {
      if (el.key === 'paint') {
        const selected = n.paints[el.index!]!;
        attrs[selected.kind === 'fill' ? 'stroke' : 'fill'] = 'none';
      }
      if (el.key === 'clip-wrap' || el.key === 'position-wrap') {
        attrs.mask = null;
        attrs['clip-path'] = null;
      }
      if (el.key?.startsWith('relative:') || el.key?.startsWith('inverted:'))
        attrs.transform = null;
      if (el.key?.startsWith('clip-outline:')) {
        const target = +el.key.split(':')[1]!;
        const parent = frame.tree.nodes[target]!.parent;
        if (parent >= 0)
          attrs.transform = `matrix(${frame.nodes[parent]!.world!.map(fmt).join(' ')})`;
      }
    }
  },
};
