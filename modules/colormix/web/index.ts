import { colormix } from '../core/index.ts';
import { colormixSVG } from '../core/svg.ts';
import { paintColor } from '../../../packages/core/src/svg.ts';
import { fmt } from '../../../packages/core/src/draw.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon, IconRenderer } from '../../../packages/web/src/index.ts';
import type { CanvasSourceHost } from '../../canvas/web/sources.ts';
const Icon = customElements.get('anima-icon') as CanvasSourceHost;
Icon.registerModule(colormix);
Icon.registerSVGBackend('colormix', colormixSVG);
// The existing canvas source seam returns patterns. Resolve theme values in the
// owning host even when the brush is requested on an offscreen effects surface.
let style: CSSStyleDeclaration | undefined;
let factory = Icon.renderers.canvas;
const wrap = (make: typeof factory): typeof factory =>
  make &&
  ((icon) => {
    const renderer = make(icon),
      draw = renderer.draw.bind(renderer);
    renderer.draw = (frame, force) => {
      if (!icon.player?.model.doc.requires?.includes('colormix')) return draw(frame, force);
      const prev = style;
      style = getComputedStyle(icon);
      try {
        draw(frame, force);
      } finally {
        style = prev;
      }
    };
    return renderer;
  });
Object.defineProperty(Icon.renderers, 'canvas', {
  configurable: true,
  get: () => wrap(factory),
  set: (next: (icon: AnimaIcon) => IconRenderer) => {
    factory = next;
  },
});
const tile = document.createElement('canvas');
tile.width = tile.height = 1;
const ctx = tile.getContext('2d')!;
(Icon.canvasSources ??= []).push((paint, target) => {
  if (!paint.mix) return;
  const { a, b, t } = paint.mix;
  const slots = {
    slot: (name: string, fallback: string) =>
      style?.getPropertyValue('--anima-' + name).trim() || fallback,
  };
  const resolve = (c: typeof a) => {
    const value = paintColor(c, slots);
    return value === 'currentColor' ? (style?.color ?? '#000') : value;
  };
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = `color-mix(in srgb, ${resolve(a)}, ${resolve(b)} ${fmt(t * 100)}%)`;
  ctx.fillRect(0, 0, 1, 1);
  return target.createPattern(tile, 'repeat')!;
});
