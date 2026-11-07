import { componentpaint } from '../core/index.ts';
import { componentpaintSVG } from '../core/svg.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import type { CanvasSourceHost, CanvasSourceHook } from '../../canvas/web/sources.ts';
const Icon = customElements.get('anima-icon') as CanvasSourceHost;
Icon.registerModule(componentpaint);
Icon.registerSVGBackend('componentpaint', componentpaintSVG);
const source: CanvasSourceHook = (paint, ctx, render) => {
  const frame = paint.component;
  if (!frame) return;
  const [x, y, w, h] = frame.viewBox,
    m = ctx.getTransform();
  const width = Math.max(1, Math.ceil(w * Math.hypot(m.a, m.b))),
    height = Math.max(1, Math.ceil(h * Math.hypot(m.c, m.d)));
  const tile = render(frame, width, height);
  const pattern = ctx.createPattern(tile, 'repeat')!;
  pattern.setTransform(new DOMMatrix([w / width, 0, 0, h / height, x, y]));
  return pattern;
};
(Icon.canvasSources ??= []).push(source);
let previous = Icon.orderSVG;
const signatures = new WeakMap<AnimaIcon, string>();
const order: NonNullable<typeof Icon.orderSVG> = (frame, elements) => {
  const resources = frame.tree.resources.filter((r) => r.kind === 'componentpaint');
  const svg = elements[0]?.[1].closest('svg');
  if (resources.length && svg) {
    const icon = (svg.getRootNode() as ShadowRoot).host as AnimaIcon;
    const signature = JSON.stringify(resources),
      before = signatures.get(icon);
    signatures.set(icon, signature);
    if (before !== signature) {
      icon.attributeChangedCallback('renderer', null, icon.getAttribute('renderer'));
      return;
    }
  }
  previous?.(frame, elements);
};
Object.defineProperty(Icon, 'orderSVG', {
  configurable: true,
  get: () => order,
  set: (next: typeof order) => {
    if (next !== order) previous = next;
  },
});
