import { text } from '../core/index.ts';
import { registerTextMeasurer } from '../core/measure.ts';
import { textSVG, textElements, textAttrs } from '../core/svg.ts';
import { browserMeasurer, cssFont } from './measure.ts';
import { cssSlots } from '../../../packages/core/src/svg.ts';
import type { TextDrawNode } from '../core/index.ts';
import type { El } from '../../../packages/core/src/svg.ts';
import type { CanvasSourceHost } from '../../canvas/web/sources.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as CanvasSourceHost;
Icon.registerModule(text);
Icon.registerSVGBackend('text', textSVG);
registerTextMeasurer(browserMeasurer());
let previous = Icon.orderSVG;
// Text roots cache layouts, SVG viewports cache paint ids, hosts mark font subscriptions.
const signatures = new WeakMap<Element, object | string | boolean>();
const order: NonNullable<typeof Icon.orderSVG> = (frame, elements) => {
  previous?.(frame, elements);
  for (const [el, dom] of elements) {
    if (el.role !== 'module:text') continue;
    const data = (frame.nodes[el.node] as TextDrawNode).text;
    if (!data || signatures.get(dom) === data.layout) continue;
    const svg = dom.closest('svg');
    if (!svg) continue;
    const id = (signatures.get(svg) as string | undefined) ?? 'text-' + serial++;
    signatures.set(svg, id);
    const make = (e: El): Element => {
      const d = document.createElementNS('http://www.w3.org/2000/svg', e.tag);
      const attrs = {};
      textAttrs(frame, e, cssSlots, id, attrs);
      for (const [k, v] of Object.entries(attrs)) if (v !== null) d.setAttribute(k, v as string);
      if (e.text !== undefined) d.textContent = e.text;
      else d.append(...e.kids.map(make));
      return d;
    };
    dom.replaceChildren(...textElements(frame, el.node).map(make));
    signatures.set(dom, data.layout);
  }
};
Object.defineProperty(Icon, 'orderSVG', {
  configurable: true,
  get: () => order,
  set: (next: typeof order) => {
    if (next !== order) previous = next;
  },
});
let serial = 0;
(Icon.canvasShapes ??= []).push((ctx, node, brush) => {
  const data = (node as TextDrawNode).text;
  if (!data) return false;
  const { layout } = data;
  ctx.save();
  if (layout.clip) {
    ctx.beginPath();
    ctx.rect(...layout.clip);
    ctx.clip();
  }
  ctx.scale(layout.scale, layout.scale);
  for (const line of layout.lines)
    for (let ci = 0; ci < line.clusters.length;) {
      const first = line.clusters[ci]!,
        start = ci;
      while (ci < line.clusters.length && line.clusters[ci]!.run === first.run) ci++;
      const text = line.clusters
        .slice(start, ci)
        .map((c) => c.text)
        .join('');
      ctx.font = cssFont(first.font);
      ctx.fontKerning = 'normal';
      ctx.textRendering = 'geometricPrecision';
      ctx.letterSpacing = first.font.tracking + 'px';
      for (const p of data.paints[first.run]!) {
        if (p.kind === 'fill') {
          ctx.fillStyle = brush(p);
          ctx.fillText(text, first.x / layout.scale, first.y / layout.scale);
        } else {
          ctx.strokeStyle = brush(p);
          ctx.lineWidth = p.width ?? 1;
          ctx.lineCap = p.cap as CanvasLineCap;
          ctx.lineJoin = p.join as CanvasLineJoin;
          ctx.strokeText(text, first.x / layout.scale, first.y / layout.scale);
        }
      }
    }
  ctx.restore();
  return true;
});
const previousEvent = Icon.eventHook;
Icon.eventHook = (icon, kind, info) => {
  previousEvent?.(icon, kind, info);
  if (kind === 'draw' && icon.player && !signatures.has(icon)) {
    signatures.set(icon, true);
    active.add(new WeakRef(icon));
  }
};
const active = new Set<WeakRef<AnimaIcon>>();
document.fonts?.addEventListener('loadingdone', () => {
  for (const ref of active) {
    const icon = ref.deref();
    if (!icon) active.delete(ref);
    else if (icon.player) {
      text.invalidateText(icon.player);
      icon.attributeChangedCallback('renderer', null, icon.getAttribute('renderer'));
    }
  }
});
