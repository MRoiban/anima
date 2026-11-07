import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import type { TextModule } from '../core/index.ts';
import { installTextHit, textHit, textSelection, textSource, type TextBox } from '../core/hit.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
for (const key of ['textHit', 'textCaret', 'textSelection'] as const)
  Object.defineProperty(Icon.prototype, key, {
    configurable: true,
    value(this: AnimaIcon, node: string, a: number, b?: number) {
      const p = this.player,
        text = Icon.modules.get('text') as TextModule | undefined;
      const i = p?.model.ids.get(node);
      if (!p || !text || i === undefined || String(p.model.nodes[i]!.type) !== 'text') return;
      const layout = text.textLayout(p, i),
        source = textSource(text, p, i);
      return key === 'textHit'
        ? textHit(layout, source, a, b!)
        : key === 'textCaret'
          ? textSelection(layout, source, a)[0]
          : textSelection(layout, source, a, b);
    },
  });
declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    textHit(node: string, x: number, y: number): number | undefined;
    textCaret(node: string, index: number): TextBox | undefined;
    textSelection(node: string, start: number, end: number): TextBox[] | undefined;
  }
}

const previous = Icon.eventHook;
Icon.eventHook = (icon, kind, info) => {
  previous?.(icon, kind, info);
  const text = Icon.modules.get('text') as TextModule | undefined;
  if (text && !text.hitTest) installTextHit(text);
};
const text = Icon.modules.get('text') as TextModule | undefined;
if (text) installTextHit(text);
