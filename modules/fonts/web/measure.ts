import { graphemes, type TextMeasurer, type Measured } from '../../text/core/measure.ts';
import { applyCanvasFont } from './settings.ts';
/** Prefix measurement retains the browser's kerning and ligature widths. Cache is bounded. */
export function optionsMeasurer(): TextMeasurer {
  const context = document.createElement('canvas').getContext('2d')!;
  const cache = new Map<string, Measured>();
  document.fonts?.addEventListener('loadingdone', () => cache.clear());
  return {
    measure(font, text) {
      const key = JSON.stringify([font, text]);
      let result = cache.get(key);
      if (result) return result;
      applyCanvasFont(context, font);
      context.textRendering = 'geometricPrecision';
      const advances = Float64Array.from(
        [...graphemes.segment(text)],
        (g) => context.measureText(text.slice(0, g.index + g.segment.length)).width,
      );
      const scale = font.size / 1000;
      applyCanvasFont(context, { ...font, size: 1000 });
      const metrics = context.measureText('Hx');
      result = {
        advances,
        ascent: (metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent) * scale,
        descent: (metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent) * scale,
        capHeight: context.measureText('H').actualBoundingBoxAscent * scale,
        xHeight: context.measureText('x').actualBoundingBoxAscent * scale,
        lineGap: 0,
      };
      if (cache.size >= 512) cache.clear();
      cache.set(key, result);
      return result;
    },
  };
}
