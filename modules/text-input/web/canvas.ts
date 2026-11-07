import './index.ts';
import type { CanvasSourceHost } from '../../canvas/web/sources.ts';
const Icon = customElements.get('anima-icon') as CanvasSourceHost;
(Icon.canvasShapes ??= []).unshift((ctx, n) => {
  for (const b of (n as import('../core/index.ts').FieldNode).fieldBoxes ?? []) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, b.radius);
    ctx.fill();
  }
  return false;
});
