import { composite } from '@anima-format/core/composite';
import { compositeSVG } from '@anima-format/core/composite-svg';
import './index.ts';
import type { AnimaIcon } from './index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(composite);
Icon.registerSVGBackend('composite', compositeSVG);

Icon.orderSVG = (f, elements) => {
  const previous = new Map<Element, Element>();
  const sorted = elements
    .filter(([el]) => el.role === 'node')
    .sort(([a], [b]) => (f.order?.[a.node] ?? a.node) - (f.order?.[b.node] ?? b.node));
  for (const [, dom] of sorted) {
    let top = dom;
    while (top.parentElement?.getAttribute('data-anima-wrap') === 'true') top = top.parentElement;
    const parent = top.parentElement!,
      prev = previous.get(parent);
    if (prev && !(prev.compareDocumentPosition(top) & 4)) parent.append(top);
    previous.set(parent, top);
  }
};
