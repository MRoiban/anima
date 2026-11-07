import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import { createTextRunAccess } from '../core/host.ts';
import type { TextModule } from '../core/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Object.defineProperty(Icon.prototype, 'textRun', {
  configurable: true,
  value(this: AnimaIcon, node: string, run: string | number, value?: string) {
    const text = Icon.modules.get('text') as TextModule | undefined;
    if (!this.player || !text) return;
    const result = createTextRunAccess(text)(this.player, node, run, value);
    if (value !== undefined)
      this.attributeChangedCallback('renderer', null, this.getAttribute('renderer'));
    return result;
  },
});
declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    textRun(node: string, run: string | number, value?: string): string | undefined;
  }
}
