import { applyCanvasFont } from './settings.ts';
import type { TextDrawNode } from '../../text/core/index.ts';
import type { CanvasSourceHost } from '../../canvas/web/sources.ts';
const Icon = customElements.get('anima-icon') as CanvasSourceHost;
(Icon.canvasShapes ??= []).unshift((ctx, node, brush) => {
  const data = (node as TextDrawNode).text;
  if (!data || (data as { effected?: boolean; backgrounds?: unknown }).backgrounds) return false;
  const { layout } = data;
  ctx.save();
  if (layout.clip) {
    ctx.beginPath();
    ctx.rect(...layout.clip);
    ctx.clip();
  }
  ctx.scale(layout.scale, layout.scale);
  for (const line of layout.lines)
    for (let ci = 0; ci < line.clusters.length;) {
      const first = line.clusters[ci]!,
        start = ci;
      while (ci < line.clusters.length && line.clusters[ci]!.run === first.run) ci++;
      const text = line.clusters
        .slice(start, ci)
        .map((c) => c.text)
        .join('');
      applyCanvasFont(ctx, first.font);
      ctx.textRendering = 'geometricPrecision';
      ctx.letterSpacing = first.font.tracking + 'px';
      for (const p of data.paints[first.run]!) {
        if (p.kind === 'fill') {
          ctx.fillStyle = brush(p);
          ctx.fillText(text, first.x / layout.scale, first.y / layout.scale);
        } else {
          ctx.strokeStyle = brush(p);
          ctx.lineWidth = p.width ?? 1;
          ctx.lineCap = p.cap as CanvasLineCap;
          ctx.lineJoin = p.join as CanvasLineJoin;
          ctx.strokeText(text, first.x / layout.scale, first.y / layout.scale);
        }
      }
    }
  ctx.restore();
  return true;
});
