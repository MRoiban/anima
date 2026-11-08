import { effectElements, effectAttrs, textEffectsSVG } from '../core/svg.ts';
import { textAttrs } from '../../text/core/svg.ts';
import { cssSlots, type El } from '../../../packages/core/src/svg.ts';
import type { DrawFrame } from '../../../packages/core/src/draw.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import '../../text/web/index.ts';
import { textEffects } from '../core/index.ts';
import type { TextDrawNode } from '../../text/core/index.ts';
import type { EffectDrawing, EffectCluster } from '../core/evaluate.ts';
// seam(P6-13): shared platform-aware settings for per-glyph axes.
import { applyCanvasFont } from '../../fonts/web/settings.ts';
import type { CanvasSourceHost } from '../../canvas/web/sources.ts';
const Icon = customElements.get('anima-icon') as CanvasSourceHost;
Icon.registerModule(textEffects);
Icon.registerSVGBackend('text-effects', textEffectsSVG);
// Capture root/frame pairs through the public ordering hook; paint after every SVG drawer.
// This also survives a separately bundled text entry being loaded after effects.
type Root = {
  frame: DrawFrame;
  node: number;
  id: string;
  layout?: object;
  first?: ChildNode | null;
};
const roots = new WeakMap<AnimaIcon, Map<Element, Root>>();
let serial = 0,
  previousOrder = Icon.orderSVG;
const order: NonNullable<typeof Icon.orderSVG> = (frame, elements) => {
  previousOrder?.(frame, elements);
  for (const [el, dom] of elements) {
    if (
      el.role !== 'module:text' ||
      !((frame.nodes[el.node] as TextDrawNode).text as EffectDrawing)?.backgrounds
    )
      continue;
    const icon = (dom.getRootNode() as ShadowRoot).host as AnimaIcon;
    if (!icon) continue;
    let map = roots.get(icon);
    if (!map) roots.set(icon, (map = new Map()));
    const old = map.get(dom);
    map.set(dom, {
      frame,
      node: el.node,
      id: old?.id ?? 'effect-' + serial++ + '-',
      layout: old?.layout,
      first: old?.first,
    });
  }
};
Object.defineProperty(Icon, 'orderSVG', {
  configurable: true,
  get: () => order,
  set: (next: typeof order) => {
    if (next !== order) previousOrder = next;
  },
});
const previousEvent = Icon.eventHook;
Icon.eventHook = (icon, kind, info) => {
  if (kind === 'draw')
    for (const [dom, root] of roots.get(icon) ?? []) {
      if (dom.getRootNode() !== icon.shadowRoot) {
        roots.get(icon)!.delete(dom);
        continue;
      }
      const data = (root.frame.nodes[root.node] as TextDrawNode).text as EffectDrawing;
      if (root.layout === data.layout && root.first === dom.firstChild) continue;
      const make = (el: El): Element => {
        const d = document.createElementNS('http://www.w3.org/2000/svg', el.tag);
        const attrs = {};
        textAttrs(root.frame, el, cssSlots, root.id, attrs);
        effectAttrs(root.frame, el, attrs, cssSlots);
        for (const [k, v] of Object.entries(attrs)) if (v !== null) d.setAttribute(k, v as string);
        if (el.text !== undefined) d.textContent = el.text;
        else d.append(...el.kids.map(make));
        return d;
      };
      dom.replaceChildren(...effectElements(root.frame, root.node).map(make));
      root.layout = data.layout;
      root.first = dom.firstChild;
    }
  previousEvent?.(icon, kind, info);
};
(Icon.canvasShapes ??= []).unshift((ctx, node, brush) => {
  const data = (node as TextDrawNode).text as EffectDrawing | undefined;
  if (!data?.backgrounds) return false;
  const { layout } = data;
  ctx.save();
  if (layout.clip) {
    ctx.beginPath();
    ctx.rect(...layout.clip);
    ctx.clip();
  }
  for (const b of data.backgrounds) {
    ctx.fillStyle = brush({ kind: 'fill', color: b.color, visible: true });
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, Math.min(b.radius ?? 0, b.width / 2, b.height / 2));
    ctx.fill();
  }
  const canvas = ctx.canvas,
    dir = canvas.dir,
    content = canvas.textContent;
  canvas.dir = data.direction ?? 'auto';
  canvas.textContent = data.runs.map((r) => r.text).join('');
  ctx.direction = canvas.matches(':dir(rtl)') ? 'rtl' : 'ltr';
  canvas.dir = dir;
  canvas.textContent = content;
  ctx.scale(layout.scale, layout.scale);
  for (const line of layout.lines)
    for (let ci = 0; ci < line.clusters.length;) {
      const c = line.clusters[ci] as EffectCluster;
      const start = ci++;
      if (!data.effected)
        while (ci < line.clusters.length && line.clusters[ci]!.run === c.run) ci++;
      const string = line.clusters
        .slice(start, ci)
        .map((c) => c.text)
        .join('');
      ctx.save();
      if (data.effected) {
        const [a, b, cc, d, x, y] = c.matrix;
        ctx.transform(a, b, cc, d, x / layout.scale, y / layout.scale);
        ctx.globalAlpha *= c.alpha;
      }
      applyCanvasFont(ctx, c.font);
      ctx.textRendering = 'geometricPrecision';
      ctx.letterSpacing = c.font.tracking + 'px';
      for (const p of data.paints[c.run]!) {
        if (p.kind === 'fill') {
          ctx.fillStyle = brush(p);
          ctx.fillText(string, c.x / layout.scale, c.y / layout.scale);
        } else {
          ctx.strokeStyle = brush(p);
          ctx.lineWidth = p.width ?? 1;
          ctx.lineCap = p.cap as CanvasLineCap;
          ctx.lineJoin = p.join as CanvasLineJoin;
          ctx.strokeText(string, c.x / layout.scale, c.y / layout.scale);
        }
      }
      ctx.restore();
    }
  ctx.restore();
  return true;
});
