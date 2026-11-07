import { graphemes, type FontSpec, type TextMeasurer, type Measured } from '../core/measure.ts';
export const cssFont = (f: FontSpec) => `${f.style} ${f.weight} ${f.size}px ${f.family}`;
/** Prefix measurement retains the browser's kerning and ligature widths. Cache is bounded. */
export function browserMeasurer(): TextMeasurer {
  const context = document.createElement('canvas').getContext('2d')!;
  const cache = new Map<string, Measured>();
  document.fonts?.addEventListener('loadingdone', () => cache.clear());
  return {
    measure(font, text) {
      const key = JSON.stringify([font, text]);
      let result = cache.get(key);
      if (result) return result;
      context.font = cssFont(font);
      context.fontKerning = 'normal';
      context.textRendering = 'geometricPrecision';
      const parts = [...graphemes.segment(text)];
      const metrics = context.measureText('Hx');
      result = {
        advances: Float64Array.from(
          parts,
          (g) => context.measureText(text.slice(0, g.index + g.segment.length)).width,
        ),
        ascent: metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent,
        descent: metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent,
        capHeight: context.measureText('H').actualBoundingBoxAscent,
        xHeight: context.measureText('x').actualBoundingBoxAscent,
        lineGap: 0,
      };
      if (cache.size >= 512) cache.clear();
      cache.set(key, result);
      return result;
    },
  };
}
