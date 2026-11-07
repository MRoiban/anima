import './index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import { config } from '../core/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.prototype.clipboardText = function (id, cut = false) {
  const el = this.textInput(id),
    p = this.player;
  if (!el || !p || config(p, p.model.ids.get(id)!)?.obscured) return '';
  const value = el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0);
  if (cut && !el.readOnly) {
    el.setRangeText('', el.selectionStart ?? 0, el.selectionEnd ?? 0, 'end');
    el.dispatchEvent(
      new InputEvent('input', { bubbles: true, composed: true, inputType: 'deleteByCut' }),
    );
  }
  return value;
};

declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    clipboardText(id: string, cut?: boolean): string;
  }
}
