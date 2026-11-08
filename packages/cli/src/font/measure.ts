import type { Diagnostic } from '@anima-format/core';
import { fault } from './binary.ts';
import { Font } from './reader.ts';
import { featureTags, substitute } from './features.ts';

// DESIGN §4. Kept local so CLI can be developed before the optional text module lands.
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
export const graphemes = (text: string) =>
  [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
export function shapingDiagnostic(text: string, pointer = ''): Diagnostic[] {
  return /[\p{Mark}\u0590-\u08ff\u0900-\u0dff\u200c\u200d]/u.test(text)
    ? [
        {
          code: 'text-shaping-approximate',
          severity: 'warning',
          pointer,
          message: 'tool text uses cmap and pair kerning; this run needs complex shaping',
          hint: 'use anima render --browser-text for browser shaping and mark positioning',
        },
      ]
    : [];
}
export class ToolMeasurer implements TextMeasurer {
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  readonly fonts = new Map<string, { font: Font; weight: number; style: 'normal' | 'italic' }[]>();
  register(family: string, font: Font, weight = 400, style: 'normal' | 'italic' = 'normal'): void {
    const key = family.toLowerCase(),
      entries = this.fonts.get(key) ?? [];
    entries.push({ font, weight, style });
    this.fonts.set(key, entries);
  }
  resolve(spec: FontSpec): Font {
    for (const family of spec.family.split(',')) {
      const entries = this.fonts.get(
        family
          .trim()
          .replace(/^['"]|['"]$/g, '')
          .toLowerCase(),
      );
      if (entries?.length)
        return [...entries].sort(
          (a, b) =>
            (a.style !== spec.style ? 10000 : 0) +
            Math.abs(a.weight - spec.weight) -
            (b.style !== spec.style ? 10000 : 0) -
            Math.abs(b.weight - spec.weight),
        )[0]!.font;
    }
    throw Object.assign(new Error('no local font registered for ' + spec.family), {
      code: 'font-missing',
      pointer: '',
      hint: 'register a local font with --font Name=path (requested family: ' + spec.family + ')',
    });
  }
  axes(spec: FontSpec, font = this.resolve(spec)): Record<string, number> {
    for (const [tag, value] of Object.entries(spec.axes ?? {})) {
      if (!font.axes.some((a) => a.tag === tag))
        fault('unknown variation axis ' + tag, 'font-axis');
      if (!Number.isFinite(value)) fault('variation coordinate must be finite', 'font-axis');
    }
    for (const [tag, value] of Object.entries(spec.features ?? {})) {
      if (!Number.isInteger(value) || value < 0)
        fault('feature value must be a nonnegative integer', 'font-feature');
      if (!featureTags(font).has(tag))
        this.onDiagnostic?.({
          code: 'font-feature',
          severity: 'warning',
          pointer: '/features/' + tag,
          message: 'font has no feature ' + tag,
          hint: 'choose a feature advertised by the font; absent features have no effect',
        });
    }
    return {
      ...(font.axes.some((a) => a.tag === 'wght') ? { wght: spec.weight } : {}),
      ...spec.axes,
    };
  }
  measure(spec: FontSpec, text: string): Measured {
    for (const diagnostic of shapingDiagnostic(text)) this.onDiagnostic?.(diagnostic);
    if (!Number.isFinite(spec.size) || spec.size <= 0 || !Number.isFinite(spec.tracking))
      fault('invalid text size or tracking');
    const font = this.resolve(spec),
      scale = spec.size / font.unitsPerEm,
      clusters = graphemes(text),
      advances = new Float64Array(clusters.length),
      axes = this.axes(spec, font);
    const shaped = substitute(font, text, spec.features);
    let pen = 0,
      previous: number | undefined,
      offset = 0,
      gi = 0;
    clusters.forEach((cluster, i) => {
      if (i) pen += spec.tracking;
      offset += cluster.length;
      while (gi < shaped.length && shaped[gi]!.start < offset) {
        const g = shaped[gi++]!.glyph;
        if (previous !== undefined) pen += font.kerning(previous, g, spec.features) * scale;
        pen += font.advance(g, axes) * scale;
        previous = g;
      }
      // A ligature's full advance belongs to its first grapheme; subsequent graphemes
      // have zero advance. The tool does not invent font ligature-caret coordinates.
      advances[i] = pen;
    });
    return {
      advances,
      ascent: font.ascent * scale,
      descent: font.descent * scale,
      capHeight: font.capHeight * scale,
      xHeight: font.xHeight * scale,
      lineGap: font.lineGap * scale,
    };
  }
  outline(spec: FontSpec, text: string, x = 0, baseline = 0): string {
    const font = this.resolve(spec),
      scale = spec.size / font.unitsPerEm,
      axes = this.axes(spec, font);
    const glyphs: {
      glyph: number;
      x: number;
      y: number;
      advanceX: number;
      advanceY: number;
      tracking: number;
    }[] = [];
    const clusters = [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(text)];
    let previousCluster = -1;
    for (const shaped of substitute(font, text, spec.features)) {
      const glyph = shaped.glyph;
      const cluster = clusters.findIndex(
        (c) => shaped.start >= c.index && shaped.start < c.index + c.segment.length,
      );
      const current = {
          glyph,
          x: 0,
          y: 0,
          advanceX: font.advance(glyph, axes),
          advanceY: 0,
          tracking: previousCluster >= 0 && cluster !== previousCluster ? spec.tracking : 0,
        },
        previous = glyphs.at(-1);
      if (previous) {
        const pair = font.positionPair(previous.glyph, glyph, spec.features);
        for (const key of ['x', 'y', 'advanceX', 'advanceY'] as const) {
          previous[key] += pair.first[key];
          current[key] += pair.second[key];
        }
      }
      glyphs.push(current);
      previousCluster = cluster;
    }
    let pen = x,
      y = baseline;
    return glyphs
      .map((g) => {
        pen += g.tracking;
        const path = font.path(g.glyph, spec.size, pen + g.x * scale, y - g.y * scale, axes);
        pen += g.advanceX * scale;
        y -= g.advanceY * scale;
        return path;
      })
      .join('');
  }
}
