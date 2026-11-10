import '../../bind/web/index.ts';
import '../../paint/web/index.ts';
import '../../assets/web/index.ts';
import '../web/index.ts';
import '../web/canvas.ts';
import { AnimaIcon } from '../../../packages/web/src/index.ts';
import { CanvasRenderer } from '../../canvas/web/index.ts';
const original = AnimaIcon.renderers.canvas!;
let renderer: CanvasRenderer;
AnimaIcon.renderers.canvas = (icon) => (renderer = original(icon) as CanvasRenderer);
const harness = {
  errors: [] as { code: string; pointer: string; hint: string; feature: string }[],
  icon: undefined as AnimaIcon | undefined,
  async mount(doc: object, backend: string, at: number) {
    this.icon?.destroy();
    const icon = (this.icon = document.createElement('anima-icon'));
    icon.style.cssText = 'display:block;width:240px;height:240px';
    icon.setAttribute('paused', '');
    icon.setAttribute('renderer', backend);
    this.errors = [];
    icon.addEventListener('anima:error', (e) => this.errors.push(...(e as CustomEvent).detail));
    document.body.replaceChildren(icon);
    icon.load(doc);
    try {
      await icon.ready;
    } catch (e) {
      throw new Error(JSON.stringify(e), { cause: e });
    }
    icon.player!.step(at);
    icon.invalidate();
    if (backend === 'canvas') {
      await renderer.ready;
      icon.invalidate();
    }
  },
};
Object.assign(window, { meshHarness: harness });
declare global {
  interface Window {
    meshHarness: typeof harness;
  }
}
