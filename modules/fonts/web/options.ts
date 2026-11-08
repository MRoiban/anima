// Optional authored text options. Resource-only fonts users pay no text/settings cost.
import './consumer.ts';
import '../../text/web/index.ts';
import { fontsSVG } from '../core/svg.ts';
import { installOptions } from '../core/options.ts';
import { cssFont } from '../core/css.ts';
import type { FontModule } from '../core/index.ts';
import { optionsMeasurer } from './measure.ts';
import './canvas.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
installOptions(Icon.modules.get('fonts') as FontModule);
(Icon.modules.get('fonts') as FontModule).setMeasurer!(optionsMeasurer());
Icon.registerSVGBackend('fonts', fontsSVG);
// Text/effects recreate SVG children through their own retained drawers. Apply settings last.
const previous = Icon.eventHook;
Icon.eventHook = (icon, kind, info) => {
  previous?.(icon, kind, info);
  if (kind !== 'draw' || !icon.player) return;
  // DOM elements carry node metadata only in the renderer's order callback; capture it there.
  for (const [el, dom, frame] of roots.get(icon) ?? []) {
    const data = (frame.nodes[el.node] as import('../../text/core/index.ts').TextDrawNode).text;
    if (!data) continue;
    let ci = 0;
    for (const line of dom.querySelectorAll(':scope > g > text, :scope > g > g')) {
      const clusters = data.layout.lines[ci++]?.clusters;
      if (!clusters) continue;
      let index = 0;
      for (const run of line.children) {
        const c = clusters[index];
        if (!c) continue;
        Object.assign((run as SVGElement).style, {
          fontVariationSettings: cssFont(c.font).fontVariationSettings,
          fontFeatureSettings: cssFont(c.font).fontFeatureSettings,
        });
        index += [
          ...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(run.textContent ?? ''),
        ].length;
      }
    }
  }
};
const roots = new WeakMap<
  AnimaIcon,
  [
    import('../../../packages/core/src/svg.ts').El,
    Element,
    import('../../../packages/core/src/draw.ts').DrawFrame,
  ][]
>();
let previousOrder = Icon.orderSVG;
const order: NonNullable<typeof Icon.orderSVG> = (frame, elements) => {
  previousOrder?.(frame, elements);
  for (const [el, dom] of elements) {
    if (el.role !== 'module:text') continue;
    const icon = (dom.getRootNode() as ShadowRoot).host as AnimaIcon;
    if (icon)
      roots.set(icon, [
        ...(roots.get(icon) ?? []).filter(
          ([, d]) => d !== dom && d.getRootNode() === icon.shadowRoot,
        ),
        [el, dom, frame],
      ]);
  }
};
Object.defineProperty(Icon, 'orderSVG', {
  configurable: true,
  get: () => order,
  set: (next: typeof order) => {
    if (next !== order) previousOrder = next;
  },
});
