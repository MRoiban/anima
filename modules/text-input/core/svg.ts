import type { SVGBackend, El } from '../../../packages/core/src/svg.ts';
import type { DrawFrame } from '../../../packages/core/src/draw.ts';
import type { FieldNode } from './index.ts';
export function boxes(f: DrawFrame, i: number): El[] {
  return ((f.nodes[i] as FieldNode).fieldBoxes ?? []).map((_, index) => ({
    tag: 'rect',
    role: 'module:field-box',
    node: i,
    index,
    kids: [],
  }));
}
export function boxAttrs(f: DrawFrame, e: El) {
  const b = (f.nodes[e.node] as FieldNode).fieldBoxes![e.index!]!;
  return {
    x: String(b.x),
    y: String(b.y),
    width: String(b.width),
    height: String(b.height),
    fill: b.color,
    rx: String(b.radius),
    'pointer-events': 'none',
  };
}
export const textinputSVG: SVGBackend = {
  tree(draw, tree) {
    const walk = (els: El[]) => {
      for (const el of [...els]) {
        if (
          (el.role === 'module:text' || el.role === 'shape') &&
          draw.nodes[el.node]!.kind === 'text'
        )
          els.unshift({ tag: 'g', role: 'module:field', node: el.node, kids: [] });
        else walk(el.kids);
      }
    };
    walk(tree.root);
  },
  attrs(f, e, _paint, _id, a) {
    if (e.role === 'module:field') e.kids = boxes(f, e.node);
    if (e.role === 'module:field-box') Object.assign(a, boxAttrs(f, e));
  },
};
