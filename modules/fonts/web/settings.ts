import { cssFont, type FontStyle } from '../core/css.ts';
/** Native settings are optional; assigning an invented property would hide a missing API. */
export function applyCanvasFont(context: CanvasRenderingContext2D, font: FontStyle) {
  const ctx = context as CanvasRenderingContext2D & {
    fontVariationSettings?: string;
    fontFeatureSettings?: string;
  };
  const css = cssFont(font);
  ctx.font = cssFont({
    ...font,
    weight: Math.max(1, Math.min(1000, font.axes?.wght ?? font.weight)),
  }).font;
  if ('fontVariationSettings' in ctx) ctx.fontVariationSettings = css.fontVariationSettings;
  if ('fontFeatureSettings' in ctx) ctx.fontFeatureSettings = css.fontFeatureSettings;
  ctx.fontKerning = font.features?.kern === 0 ? 'none' : 'normal';
}
