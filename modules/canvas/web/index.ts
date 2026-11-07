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
Icon.canvasBox = (icon, bounds) =>
  icon.getAttribute('renderer') === 'canvas' ? renderers.get(icon)?.nodeBox(bounds) : undefined;
Object.defineProperty(Icon.prototype, 'devicePixelRatioUsed', {
  get(this: AnimaIcon) {
    return this.getAttribute('renderer') === 'canvas' ? renderers.get(this)?.pixelRatio : undefined;
  },
});
declare module '../../../packages/web/src/index.ts' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace AnimaIcon {
    let canvasBox: (
      icon: AnimaIcon,
      bounds: [number, number, number, number],
    ) => DOMRect | undefined;
  }
  interface AnimaIcon {
    readonly devicePixelRatioUsed: number | undefined;
  }
}
export { CanvasRenderer };
