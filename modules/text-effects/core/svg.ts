import type { SVGBackend, El, Attrs, Paint } from '../../../packages/core/src/svg.ts';
import { paintColor } from '../../../packages/core/src/svg.ts';
import { fmt } from '../../../packages/core/src/draw.ts';
import type { DrawFrame } from '../../../packages/core/src/draw.ts';
import { textElements } from '../../text/core/svg.ts';
import type { TextDrawNode } from '../../text/core/index.ts';
import type { EffectDrawing, EffectCluster } from './evaluate.ts';
export function effectElements(f: DrawFrame, node: number): El[] {
  const els = textElements(f, node);
  const data = (f.nodes[node] as TextDrawNode).text as EffectDrawing;
  const content = els.at(-1)!;
  if (data.effected)
    content.kids.forEach((line, li) => {
      line.tag = 'g';
      line.kids = data.layout.lines[li]!.clusters.map((c, ci) => ({
        tag: 'text',
        role: 'module:text-run',
        node,
        index: li,
        key: String(ci),
        text: c.text,
        kids: [],
      }));
    });
  content.kids.unshift(
    ...(data.backgrounds ?? []).map((_b, index) => ({
      tag: 'rect',
      role: 'module:text-background',
      node,
      index,
      kids: [],
    })),
  );
  return els;
}
export function effectAttrs(f: DrawFrame, el: El, a: Attrs, paint: Paint) {
  const data = (f.nodes[el.node] as TextDrawNode).text as EffectDrawing | undefined;
  if (!data) return;
  if (el.role === 'module:text-line' && data.direction) {
    a.direction = data.direction === 'auto' ? null : data.direction;
    a['unicode-bidi'] = data.direction === 'auto' ? 'plaintext' : 'embed';
  }
  if (el.role === 'module:text-background') {
    const b = data.backgrounds![el.index!]!;
    Object.assign(a, {
      x: fmt(b.x),
      y: fmt(b.y),
      width: fmt(b.width),
      height: fmt(b.height),
      fill: paintColor(b.color, paint),
      rx: fmt(b.radius ?? 0),
    });
  }
  if (el.role !== 'module:text-run' || !data.effected) return;
  const c = data.layout.lines[el.index!]!.clusters[+el.key!] as EffectCluster;
  const s = data.layout.scale;
  a.transform = `matrix(${c.matrix.map(fmt).join(' ')})` + (s === 1 ? '' : ` scale(${fmt(s)})`);
  a.opacity = fmt(c.alpha);
  // seam(P6-13): keep authored font features when applying per-glyph axes.
  a.style =
    (a.style ? a.style + ';' : '') +
    'font-variation-settings:' +
    Object.entries(c.font.axes ?? {})
      .map(([k, v]) => `"${k}" ${v}`)
      .join(',');
}
export const textEffectsSVG: SVGBackend = {
  attrs(f, el, paint, _id, a) {
    if (!el.role.startsWith('module:text')) return;
    if (
      el.role === 'module:text' &&
      ((f.nodes[el.node] as TextDrawNode).text as EffectDrawing)?.backgrounds
    )
      el.kids = effectElements(f, el.node);
    effectAttrs(f, el, a, paint);
  },
};
