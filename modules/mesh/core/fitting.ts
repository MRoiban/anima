import type { Geometry } from '../../../packages/core/src/draw.ts';
/** Image box → fitted texture rectangle, in node-local grid units. */
export function imageRect(g: Geometry): number[] {
  const r = g.image!,
    w = g.width!,
    h = g.height!,
    iw = r.width ?? w,
    ih = r.height ?? h;
  const sx = w / iw,
    sy = h / ih;
  const scale =
    r.fit === 'cover'
      ? Math.max(sx, sy)
      : r.fit === 'none'
        ? 1
        : r.fit === 'scale-down'
          ? Math.min(1, sx, sy)
          : r.fit === 'fit-width'
            ? sx
            : r.fit === 'fit-height'
              ? sy
              : Math.min(sx, sy);
  const fill = r.fit === 'fill' || r.fit === 'resize',
    dw = fill ? w : iw * scale,
    dh = fill ? h : ih * scale;
  const align = (low: string, high: string) =>
    r.align.includes(low) ? 0 : r.align.includes(high) ? 1 : 0.5;
  return [(w - dw) * align('left', 'right'), (h - dh) * align('top', 'bottom'), dw, dh];
}
