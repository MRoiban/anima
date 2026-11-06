import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import { CanvasRenderer } from './renderer.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
const renderers = new WeakMap<AnimaIcon, CanvasRenderer>();
Icon.renderers.canvas = (icon) => {
  const renderer = new CanvasRenderer(icon);
  renderers.set(icon, renderer);
  return renderer;
};
Object.defineProperty(Icon.prototype, 'devicePixelRatioUsed', {
  get(this: AnimaIcon) {
    return this.getAttribute('renderer') === 'canvas' ? renderers.get(this)?.pixelRatio : undefined;
  },
});
declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    readonly devicePixelRatioUsed: number | undefined;
  }
}
export { CanvasRenderer };
