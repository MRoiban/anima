import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { overflowText, type TextOverflow } from './overflow.ts';
import {
  graphemes,
  words,
  measure,
  missingTextDependency,
  type FontSpec,
  type Measured,
} from './measure.ts';
export interface TextStyle {
  font?: string;
  size?: number;
  weight?: number;
  style?: 'normal' | 'italic';
  tracking?: number;
  lineHeight?: number;
  axes?: Record<string, number>;
  features?: Record<string, number>;
  fill?: unknown;
  stroke?: unknown;
}
export interface TextRun {
  id?: string;
  text: string;
  style?: string;
}
export interface LayoutInput {
  runs: TextRun[];
  styles: Record<string, TextStyle>;
  width?: number;
  height?: number;
  sizing?: 'fixed' | 'auto-width' | 'auto-height';
  align?: 'left' | 'center' | 'right' | 'start' | 'end';
  valign?: 'top' | 'middle' | 'bottom';
  origin?: 'top-left' | 'baseline' | [number, number];
  overflow?: 'visible' | 'hidden' | 'clipped' | 'ellipsis' | 'fit' | 'fit-font-size';
  wrap?: boolean;
  wordBreak?: 'normal' | 'break-word' | 'break-all';
  lineHeight?: number;
  paragraphSpacing?: number;
  verticalTrimTop?: 'none' | 'cap' | 'x-height';
  verticalTrimBottom?: 'none' | 'baseline';
  fitFromBaseline?: boolean;
  fitFontSizeResizesBox?: boolean;
}
export interface Cluster {
  text: string;
  /** UTF-16 offset in the concatenated logical input, also suitable for DOM selection. */
  index: number;
  run: number;
  x: number;
  y: number;
  advance: number;
  font: FontSpec;
}
export interface TextLine {
  clusters: Cluster[];
  baseline: number;
  width: number;
  ascent: number;
  descent: number;
  height: number;
}
export interface TextLayout {
  lines: TextLine[];
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
  fittedSize: number;
  scale: number;
  clip?: [number, number, number, number];
}
export const styleDefaults = {
  font: 'sans-serif',
  size: 1,
  weight: 400,
  tracking: 0,
  lineHeight: 0,
};
export const fontSpec = (s: TextStyle, scale = 1): FontSpec => ({
  family: s.font ?? styleDefaults.font,
  size: (s.size ?? styleDefaults.size) * scale,
  weight: s.weight ?? styleDefaults.weight,
  style: s.style ?? 'normal',
  tracking: s.tracking ?? styleDefaults.tracking,
  axes: s.axes,
  features: s.features,
});
interface Glyph extends Cluster {
  metrics: Measured;
  lineHeight: number;
  breakAfter: boolean;
}
export const textSizing = ({
  sizing,
  width,
  height,
}: Pick<LayoutInput, 'sizing' | 'width' | 'height'>) =>
  sizing ?? (width !== undefined && height !== undefined ? 'fixed' : 'auto-width');
/** One pure algorithm shared by browser and tooling. No system font assumptions. */
export function layoutText(
  input: LayoutInput,
  overflow: TextOverflow | null = V ? overflowText : null,
): TextLayout {
  const sizing = textSizing(input);
  const limit = sizing === 'auto-width' ? Infinity : (input.width ?? Infinity);
  const boxHeight = sizing === 'fixed' ? (input.height ?? Infinity) : Infinity;
  const build = (factor: number): TextLayout & { topTrim: number } => {
    const glyphs: Glyph[] = [];
    let offset = 0;
    const full = input.runs.map((r) => r.text).join('');
    const breaks = new Set([...words.segment(full)].map((w) => w.index + w.segment.length));
    const normalized = input.runs.map((r) => ({ ...r, text: '' }));
    const ends: number[] = [];
    let total = 0,
      owner = 0;
    for (const r of input.runs) ends.push((total += r.text.length));
    for (const g of graphemes.segment(full)) {
      while (owner < ends.length - 1 && g.index >= ends[owner]!) owner++;
      normalized[owner]!.text += g.segment;
    }
    normalized.forEach((run, ri) => {
      const style = input.styles[run.style ?? ''] ?? {};
      const font = fontSpec(style, factor);
      // Explicit line separators are never passed to a platform measurer.
      let start = 0;
      for (const part of run.text.split(/(\r\n|\n|\r)/)) {
        const segments = [...graphemes.segment(part)];
        const newline = /^(\r\n|\n|\r)$/.test(part);
        const metrics = measure(font, newline ? '' : part);
        segments.forEach((g, gi) =>
          glyphs.push({
            text: g.segment,
            index: offset + start + g.index,
            run: ri,
            x: 0,
            y: 0,
            font,
            metrics,
            advance: newline ? 0 : (metrics.advances[gi] ?? 0) - (metrics.advances[gi - 1] ?? 0),
            lineHeight: (style.lineHeight ?? input.lineHeight ?? 0) * font.size,
            breakAfter: breaks.has(offset + start + g.index + g.segment.length),
          }),
        );
        start += part.length;
      }
      offset += run.text.length;
    });
    const fallback = fontSpec(input.styles[input.runs[0]?.style ?? ''] ?? {}, factor);
    const fm = measure(fallback, '');
    const lines: TextLine[] = [];
    let y = 0;
    // Kerning and ligatures do not cross a soft break: lines measure their own run fragments.
    const remeasure = (gs: Glyph[]) => {
      for (let i = 0; i < gs.length;) {
        let j = i;
        while (j < gs.length && gs[j]!.run === gs[i]!.run) j++;
        const m = measure(
          gs[i]!.font,
          gs
            .slice(i, j)
            .map((g) => g.text)
            .join(''),
        ).advances;
        for (let k = i; k < j; k++) gs[k]!.advance = m[k - i]! - (m[k - i - 1] ?? 0);
        i = j;
      }
      return gs;
    };
    const emit = (gs: Glyph[], paragraph = false) => {
      remeasure(gs);
      let ascent = gs.length ? 0 : fm.ascent,
        descent = gs.length ? 0 : fm.descent,
        height = 0,
        x = 0;
      for (const g of gs) {
        ascent = Math.max(ascent, g.metrics.ascent);
        descent = Math.max(descent, g.metrics.descent);
        height = Math.max(
          height,
          g.lineHeight || g.metrics.ascent + g.metrics.descent + g.metrics.lineGap,
        );
      }
      if (!height)
        height = (input.lineHeight ?? 0) * fallback.size || ascent + descent + fm.lineGap;
      const baseline = y + ascent + Math.max(0, height - ascent - descent) / 2;
      gs.forEach((g, i) => {
        g.x = x;
        g.y = baseline;
        x += g.advance + (i + 1 < gs.length ? g.font.tracking : 0);
      });
      lines.push({ clusters: gs, baseline, width: x, ascent, descent, height });
      y += height + (paragraph ? (input.paragraphSpacing ?? 0) : 0);
    };
    let pending: Glyph[] = [],
      width = 0;
    for (const glyph of glyphs) {
      if (/^[\r\n]/.test(glyph.text)) {
        emit(pending, true);
        pending = [];
        width = 0;
        continue;
      }
      pending.push(glyph);
      width +=
        glyph.advance + (pending.length > 1 ? pending[pending.length - 2]!.font.tracking : 0);
      if (input.wrap === false || width <= limit || pending.length === 1) continue;
      let at = input.wordBreak === 'break-all' ? pending.length - 1 : 0;
      if (!at) for (let i = 0; i < pending.length - 1; i++) if (pending[i]!.breakAfter) at = i + 1;
      if (!at && input.wordBreak === 'break-word') at = pending.length - 1;
      if (!at) continue; // normal preserves an unbreakable word, even beyond the box.
      emit(pending.slice(0, at));
      pending = remeasure(pending.slice(at));
      width = pending.reduce(
        (n, g, i) => n + g.advance + (i ? pending[i - 1]!.font.tracking : 0),
        0,
      );
    }
    emit(pending);
    const first = lines[0]!,
      last = lines[lines.length - 1]!;
    const topTrim =
      input.verticalTrimTop === 'cap'
        ? first.baseline -
          ((first.clusters[0] as Glyph | undefined)?.metrics.capHeight ?? fm.capHeight)
        : input.verticalTrimTop === 'x-height'
          ? first.baseline -
            ((first.clusters[0] as Glyph | undefined)?.metrics.xHeight ?? fm.xHeight)
          : 0;
    const bottomTrim = input.verticalTrimBottom === 'baseline' ? y - last.baseline : 0;
    const contentHeight = y - topTrim - bottomTrim;
    const contentWidth = Math.max(0, ...lines.map((l) => l.width));
    return {
      lines,
      width: sizing === 'auto-width' ? contentWidth : (input.width ?? contentWidth),
      height: sizing === 'fixed' ? (input.height ?? contentHeight) : contentHeight,
      contentWidth,
      contentHeight,
      fittedSize: fallback.size,
      scale: 1,
      // Internal trim shift is applied before alignment below.
      ...{ topTrim },
    };
  };
  let out = build(1);
  if (input.overflow && input.overflow !== 'visible' && input.overflow !== 'clipped') {
    if (!overflow)
      missingTextDependency(
        'text-overflow',
        V && 'anima: text-overflow: register overflow policies before measuring overflow text',
        V && "import '@anima-format/web/text-overflow' before measuring overflow text",
      );
    out = overflow(input, out, build, limit, boxHeight, measure);
  }
  const origin = input.origin ?? 'top-left';
  const ox = Array.isArray(origin) ? -origin[0] * out.width : 0;
  const sy =
    input.valign === 'middle'
      ? (out.height - out.contentHeight * out.scale) / 2
      : input.valign === 'bottom'
        ? out.height - out.contentHeight * out.scale
        : 0;
  const trim = (out as TextLayout & { topTrim: number }).topTrim;
  const oy = Array.isArray(origin)
    ? -origin[1] * out.height
    : origin === 'baseline'
      ? -((out.lines[0]?.baseline ?? 0) - trim) * out.scale - sy
      : 0;
  for (const line of out.lines) {
    const dx =
      ox +
      (input.align === 'center'
        ? (out.width - line.width * out.scale) / 2
        : input.align === 'right' || input.align === 'end'
          ? out.width - line.width * out.scale
          : 0);
    line.baseline = (line.baseline - trim) * out.scale + sy + oy;
    line.width *= out.scale;
    for (const g of line.clusters) {
      g.x = g.x * out.scale + dx;
      g.y = line.baseline;
      g.advance *= out.scale;
    }
  }
  if (input.overflow === 'clipped') out.clip = [ox, oy, out.width, out.height];
  delete (out as TextLayout & { topTrim?: number }).topTrim;
  return out;
}
