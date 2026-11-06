// Stroke effects compile to per-paint paths. Fill geometry remains unchanged.
import { geometryPath } from './effects.ts';
import type { SVGBackend, El } from '../../../packages/core/src/svg.ts';
export const contourSVG: SVGBackend = {
  tree(draw, tree) {
    const affected = new Set(
      draw.resources.filter((r) => r.kind === 'contour-effects').map((r) => r.node),
    );
    const visit = (el: El) => {
      el.kids.forEach(visit);
      if (!affected.has(el.node)) return;
      if (el.role === 'shape') {
        el.tag = 'g';
        el.kids = ['fill', 'stroke'].map((key) => ({
          tag: 'path',
          role: 'module:contour',
          node: el.node,
          key,
          kids: [],
        }));
      } else if (
        el.role === 'module:composite' &&
        ['paint', 'stroke-only', 'fill-only'].includes(el.key!)
      )
        el.tag = 'path';
    };
    tree.root.forEach(visit);
    tree.defs.forEach(visit);
  },
  attrs(frame, el, paint, id, attrs, render) {
    const node = frame.nodes[el.node]!;
    if (
      el.role === 'shape' &&
      el.tag === 'g' &&
      frame.tree.resources.some((r) => r.node === el.node && r.kind === 'contour-effects')
    ) {
      attrs.fill = 'none';
      attrs.stroke = 'none';
    }
    if (el.role === 'module:contour') {
      const selected = node.paints.find((p) => p.kind === el.key);
      const nodes = frame.nodes.slice();
      nodes[el.node] = { ...node, paints: selected ? [selected] : [] };
      Object.assign(attrs, render({ ...frame, nodes }, { ...el, role: 'shape' }, paint, id));
      if (!selected) attrs.display = 'none';
      attrs[selected?.kind === 'fill' ? 'stroke' : 'fill'] = 'none';
      if (node.geometry) attrs.d = selected?.geometry?.d ?? geometryPath(node.geometry);
    } else if (
      frame.tree.resources.some((r) => r.node === el.node && r.kind === 'contour-effects') &&
      el.role === 'module:composite' &&
      ['paint', 'stroke-only', 'fill-only'].includes(el.key!)
    ) {
      const selected =
        el.key === 'paint'
          ? node.paints[el.index!]
          : node.paints.find((p) => p.kind === (el.key === 'fill-only' ? 'fill' : 'stroke'));
      if (node.geometry) attrs.d = selected?.geometry?.d ?? geometryPath(node.geometry);
    }
  },
};
