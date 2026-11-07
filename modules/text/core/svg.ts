import type { SVGBackend, El, Attrs, Paint } from '../../../packages/core/src/svg.ts';
import { paintAttrs } from '../../../packages/core/src/svg.ts';
import type { DrawFrame } from '../../../packages/core/src/draw.ts';
import { fmt } from '../../../packages/core/src/draw.ts';
import { gradientTree, gradientAttrs } from '../../paint/core/svg.ts';
import type { TextDrawNode } from './index.ts';
/** Build the live text subtree; both static SVG and DOM consume these same elements/attributes. */
export function textElements(frame: DrawFrame, node: number): El[] {
  const data = (frame.nodes[node] as TextDrawNode).text;
  if (!data) return [];
  const { layout, paints } = data;
  const defs: El[] = [];
  paints.forEach((ps, ri) =>
    ps.forEach((p) => {
      if (p.type) {
        const g = gradientTree(node, ri + '-' + p.kind, p);
        const mark = (e: El) => {
          e.role = 'module:text-gradient';
          e.key = ri + '-' + p.kind;
          e.kids.forEach(mark);
        };
        mark(g);
        defs.push(g);
      }
    }),
  );
  if (layout.clip)
    defs.push({
      tag: 'clipPath',
      role: 'module:text-clip',
      node,
      kids: [{ tag: 'rect', role: 'module:text-clip-box', node, kids: [] }],
    });
  const lines: El[] = layout.lines.map((_line, li) => ({
    tag: 'text',
    role: 'module:text-line',
    node,
    index: li,
    kids: [],
  }));
  layout.lines.forEach((line, li) => {
    for (let ci = 0; ci < line.clusters.length;) {
      const first = line.clusters[ci]!,
        start = ci;
      while (ci < line.clusters.length && line.clusters[ci]!.run === first.run) ci++;
      lines[li]!.kids.push({
        tag: 'tspan',
        role: 'module:text-run',
        node,
        index: li,
        key: String(start),
        text: line.clusters
          .slice(start, ci)
          .map((c) => c.text)
          .join(''),
        kids: [],
      });
    }
  });
  return [...defs, { tag: 'g', role: 'module:text-content', node, kids: lines }];
}
export function textAttrs(f: DrawFrame, el: El, paint: Paint, id: string, a: Attrs) {
  const data = (f.nodes[el.node] as TextDrawNode).text;
  if (!data) return;
  const { layout } = data;
  const clipId = id + 'text-clip-' + el.node;
  if (el.role === 'module:text') {
    el.kids = textElements(f, el.node);
    return;
  }
  if (el.role === 'module:text-clip') {
    a.id = clipId;
    return;
  }
  if (el.role === 'module:text-clip-box') {
    const [x, y, width, height] = layout.clip!;
    Object.assign(a, { x: fmt(x), y: fmt(y), width: fmt(width), height: fmt(height) });
    return;
  }
  if (el.role === 'module:text-content') {
    a['clip-path'] = layout.clip ? `url(#${clipId})` : null;
    return;
  }
  if (el.role === 'module:text-line') {
    a.style = 'white-space:pre';
    a['text-rendering'] = 'geometricPrecision';
    return;
  }
  if (el.role === 'module:text-gradient') {
    const [run, kind] = el.key!.split('-');
    const p = data.paints[+run!]!.find((p) => p.kind === kind)!;
    gradientAttrs(p, el.node, el.key!, el.index, paint, id, a);
    return;
  }
  if (el.role !== 'module:text-run') return;
  const cluster = layout.lines[el.index!]!.clusters[+el.key!]!;
  const font = cluster.font,
    ps = data.paints[cluster.run]!;
  paintAttrs(
    ps.find((p) => p.kind === 'fill'),
    ps.find((p) => p.kind === 'stroke'),
    paint,
    a,
  );
  for (const p of ps) if (p.type) a[p.kind] = `url(#${id}p${el.node}-${cluster.run}-${p.kind})`;
  Object.assign(a, {
    x: fmt(cluster.x / layout.scale),
    y: fmt(cluster.y / layout.scale),
    'font-family': font.family,
    'font-size': fmt(font.size),
    'font-weight': String(font.weight),
    'font-style': font.style,
    'letter-spacing': fmt(font.tracking),
    transform: layout.scale === 1 ? null : `scale(${fmt(layout.scale)})`,
  });
}
export const textSVG: SVGBackend = {
  tree(draw, tree) {
    const walk = (els: El[]) => {
      for (const el of els) {
        if (el.role === 'shape' && draw.nodes[el.node]!.kind === 'text') {
          el.tag = 'g';
          el.role = 'module:text';
        } else walk(el.kids);
      }
    };
    walk(tree.root);
  },
  attrs(f, el, paint, id, a) {
    if (el.role.startsWith('module:text')) textAttrs(f, el, paint, id, a);
  },
};
