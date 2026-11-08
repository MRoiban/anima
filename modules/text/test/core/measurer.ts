import type { TextMeasurer } from '../../core/measure.ts';
import { graphemes } from '../../core/measure.ts';
/** Test-only fixture: one unit per em per grapheme, no host font dependence. */
export const fixedMeasurer: TextMeasurer = {
  measure(font, text) {
    return {
      advances: Float64Array.from([...graphemes.segment(text)], (_g, i) => (i + 1) * font.size),
      ascent: font.size * 0.8,
      descent: font.size * 0.2,
      capHeight: font.size * 0.7,
      xHeight: font.size * 0.5,
      lineGap: 0,
    };
  },
};
