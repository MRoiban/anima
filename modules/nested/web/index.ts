import { nested } from '../core/index.ts';
import { nestedSVG } from '../core/svg.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(nested);
Icon.registerSVGBackend('nested', nestedSVG);
let previous = Icon.orderSVG;
type Records = Parameters<NonNullable<typeof Icon.orderSVG>>[1];
const views = new WeakMap<
  AnimaIcon,
  { signature: string; retained?: Records; elements: Records }
>();
const hosts = new WeakMap<import('../../../packages/core/src/player.ts').Player, AnimaIcon>();
const token = (el: Records[number][0]) => [el.node, el.role, el.key, el.index].join(':');
// The host's renderer refresh uses its live SVG backends, including separately emitted bundles.
// Retain matching DOM across that refresh; the player and all input handlers stay on the host.
const order: NonNullable<typeof Icon.orderSVG> = (frame, elements) => {
  if (!(Icon.modules.get('nested') as typeof nested).dynamicTrees.has(frame.tree)) {
    previous?.(frame, elements);
    return;
  }
  const svg = elements[0]?.[1].closest('svg');
  const icon =
    svg?.getRootNode() instanceof ShadowRoot
      ? ((svg.getRootNode() as ShadowRoot).host as AnimaIcon)
      : undefined;
  if (!svg || !icon) return;
  if (icon.player) hosts.set(icon.player, icon);
  const signature = JSON.stringify([frame.tree.nodes, frame.tree.resources]);
  let view = views.get(icon);
  if (!view || view.signature !== signature) {
    view = { signature, retained: [...elements], elements };
    views.set(icon, view);
    // Refresh geometry only, through the same path as selecting the SVG renderer.
    icon.attributeChangedCallback('renderer', null, icon.getAttribute('renderer'));
    return;
  }
  view.elements = elements;
  if (view.retained) {
    const retained = view.retained;
    view.retained = undefined;
    const index = (records: Records) => {
      const nodes = new Map(records.map((r) => [r[1], r]));
      const path = (dom: Element): string => {
        const rec = nodes.get(dom);
        return (
          (dom.parentElement ? path(dom.parentElement) : '') +
          '/' +
          (rec ? token(rec[0]) : dom.localName)
        );
      };
      return new Map(records.map((r) => [path(r[1]), r]));
    };
    const old = index(retained),
      fresh = index(elements);
    const keys = new Map([...fresh].map(([key, record]) => [record[1], key]));
    const restore = (dom: Element): Element => {
      const children = [...dom.children].map(restore);
      const key = keys.get(dom),
        record = key && fresh.get(key),
        match = key && old.get(key);
      if (!record || !match || match[1].localName !== dom.localName) {
        dom.replaceChildren(...children);
        return dom;
      }
      const target = match[1];
      for (const attr of [...target.attributes])
        if (!dom.hasAttribute(attr.name)) target.removeAttribute(attr.name);
      for (const attr of [...dom.attributes]) target.setAttribute(attr.name, attr.value);
      target.replaceChildren(...children);
      record[1] = target;
      return target;
    };
    svg.replaceChildren(...[...svg.children].map(restore));
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
