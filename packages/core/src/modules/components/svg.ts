import type { SVGBackend } from '../../svg.ts';
export const componentsSVG: SVGBackend = {
  attrs(frame, el, _paint, id, attrs) {
    const name = frame.tree.nodes[el.node]?.id;
    if (name && el.role === 'node') attrs.id = id + name;
  },
};
