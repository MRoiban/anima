import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
/** The shared P6 measurer contract. Advances exclude tracking; layout adds it between clusters. */
export type FontSpec = {
  family: string;
  size: number;
  weight: number;
  style: 'normal' | 'italic';
  axes?: Record<string, number>;
  features?: Record<string, number>;
  tracking: number;
};
export type Measured = {
  advances: Float64Array;
  ascent: number;
  descent: number;
  capHeight: number;
  xHeight: number;
  lineGap: number;
};
export interface TextMeasurer {
  measure(font: FontSpec, text: string): Measured;
}
let current: TextMeasurer | undefined;
export let fontRevision = 0;
/** Without an argument, keeps the active measurer and only bumps the font revision. */
export function registerTextMeasurer(measurer: TextMeasurer = current!): void {
  current = measurer;
  fontRevision++;
}
/** Compatibility with the independently shipped P6-2 installer. */
export const setTextMeasurer = registerTextMeasurer;
export function measure(font: FontSpec, text: string): Measured {
  if (!current)
    missingTextDependency(
      'text-measurer',
      V && 'anima: text-measurer: register a text measurer before drawing',
      V && 'import the text web entry or register a tool measurer',
    );
  // Layout owns inter-cluster tracking, including across style/run boundaries.
  return current.measure({ ...font, tracking: 0 }, text);
}
/** Shared diagnostic for missing optional text implementations. */
export function missingTextDependency(
  code: string,
  message: string | false,
  hint: string | false,
): never {
  throw Object.assign(new Error(V ? message || code : code), {
    code,
    pointer: '/requires',
    ...(V ? { hint } : {}),
  });
}
export const graphemes = new Intl.Segmenter('und', { granularity: 'grapheme' });
export const words = new Intl.Segmenter('und', { granularity: 'word' });
