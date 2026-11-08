import type { SVGBackend, El } from '../../../packages/core/src/svg.ts';
export type LayoutEntry = import('../../../packages/core/src/draw.ts').DrawEntry & {
  layout?: boolean;
};
export const layoutSVG: SVGBackend = {
  tree(draw, tree) {
    const visit = (els: El[]) => {
      for (const el of els) {
        visit(el.kids);
        if (
          el.role === 'node' &&
          draw.nodes[el.node]!.kind === 'group' &&
          (draw.nodes[el.node]! as LayoutEntry).layout
        )
          el.kids.unshift({ tag: 'rect', role: 'shape', node: el.node, kids: [] });
      }
    };
    visit(tree.root);
  },
};
