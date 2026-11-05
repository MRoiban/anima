import type { SVGBackend } from '../../../packages/core/src/svg.ts';
export const componentsSVG: SVGBackend = {
  attrs(frame, el, _paint, id, attrs) {
    const name = frame.tree.nodes[el.node]?.id;
    if (name && el.role === 'node') attrs.id = id + name;
  },
};
