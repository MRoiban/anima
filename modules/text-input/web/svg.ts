import './index.ts';
import { textinputSVG, boxes, boxAttrs } from '../core/svg.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerSVGBackend('text-input', textinputSVG);
let previous = Icon.orderSVG;
const order: NonNullable<typeof Icon.orderSVG> = (f, elements) => {
  previous?.(f, elements);
  for (const [e, dom] of elements)
    if (e.role === 'module:field')
      dom.replaceChildren(
        ...boxes(f, e.node).map((e) => {
          const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          for (const [k, v] of Object.entries(boxAttrs(f, e))) r.setAttribute(k, v);
          return r;
        }),
      );
};
Object.defineProperty(Icon, 'orderSVG', {
  configurable: true,
  get: () => order,
  set: (next: typeof order) => {
    if (next !== order) previous = next;
  },
});

for (const icon of document.querySelectorAll<AnimaIcon>('anima-icon'))
  if (icon.player?.model.doc.requires?.includes('textinput'))
    icon.attributeChangedCallback('renderer', null, icon.getAttribute('renderer'));
