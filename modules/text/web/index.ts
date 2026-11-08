import { text } from '../core/index.ts';
import { registerTextMeasurer } from '../core/measure.ts';
import { textSVG, textElements, textAttrs } from '../core/svg.ts';
import { browserMeasurer } from './measure.ts';
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
const paints = new WeakMap<Element, string>();
const order: NonNullable<typeof Icon.orderSVG> = (frame, elements) => {
  previous?.(frame, elements);
  for (const [el, dom] of elements) {
    if (el.role !== 'module:text') continue;
    const data = (frame.nodes[el.node] as TextDrawNode).text;
    // Paints are resolved per frame; animated colors must rebuild even when layout is retained.
    const paint = data && JSON.stringify(data.paints);
    if (!data || (signatures.get(dom) === data.layout && paints.get(dom) === paint)) continue;
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
    paints.set(dom, paint!);
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
