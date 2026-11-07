import type { Model } from '../../../packages/core/src/load.ts';
import { fmt } from '../../../packages/core/src/draw.ts';
import { sceneTree, type El, type SVGBackend } from '../../../packages/core/src/svg.ts';
import type { ComponentResource } from './index.ts';
const originals = new WeakMap<El, El>();
export const componentpaintSVG: SVGBackend = {
  tree(draw, tree) {
    for (const resource of draw.resources) {
      if (resource.kind !== 'componentpaint') continue;
      const r = resource as ComponentResource,
        node = r.node;
      let source: ReturnType<typeof sceneTree>;
      try {
        source = sceneTree({ draw: r.tree } as Model);
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'unsupported-render')
          throw Object.assign(new Error('component paint source: ' + error.message), {
            code: 'unsupported-render',
            pointer: r.pointer,
            hint: 'use the canvas renderer for this source feature',
          });
        throw error;
      }
      const order = (list: El[]): El[] => {
        for (const el of list) el.kids = order(el.kids);
        return new Set(list.map((el) => el.node)).size === list.length
          ? list.sort((a, b) => (r.order?.[a.node] ?? a.node) - (r.order?.[b.node] ?? b.node))
          : list;
      };
      source.root = order(source.root);
      const wrap = (el: El): El => {
        const copy = { ...el, role: 'module:componentpaint-source', node, kids: el.kids.map(wrap) };
        originals.set(copy, el);
        return copy;
      };
      tree.defs.push({
        tag: 'pattern',
        role: 'module:componentpaint',
        node,
        kids: [
          ...source.defs.map(wrap),
          { tag: 'svg', role: 'module:componentpaint-box', node, kids: source.root.map(wrap) },
        ],
      });
    }
  },
  attrs(frame, el, paint, id, a, render) {
    const source = frame.nodes[el.node]?.paints.find((p) => p.component)?.component;
    if (!source) return;
    const prefix = `${id}cp${el.node}`;
    if (el.role === 'shape' && a.fill !== 'none') a.fill = `url(#${prefix})`;
    if (el.role === 'module:componentpaint' || el.role === 'module:componentpaint-box') {
      const [x, y, w, h] = source.viewBox;
      Object.assign(a, { x: fmt(x), y: fmt(y), width: fmt(w), height: fmt(h) });
      if (el.role === 'module:componentpaint')
        Object.assign(a, { id: prefix, patternUnits: 'userSpaceOnUse' });
      else
        Object.assign(a, {
          x: '0',
          y: '0',
          viewBox: source.viewBox.map(fmt).join(' '),
          overflow: 'hidden',
          style: `width:${fmt(w)}px;height:${fmt(h)}px;overflow:hidden`,
        });
    }
    const original = originals.get(el);
    if (original) Object.assign(a, render(source, original, paint, prefix + '-'));
  },
};
