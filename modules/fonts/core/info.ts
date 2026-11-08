import { Font } from './opentype/reader.ts';
import { Bytes, fault, MAX_FONT } from './opentype/binary.ts';
import { featureTags, substitute } from './opentype/features.ts';
export interface FontOptions {
  axes?: Record<string, number>;
  features?: Record<string, number>;
}
/** Immutable options over a shared decoded face. All metrics and paths use font units. */
export class FontInfo {
  readonly options: {
    axes: Readonly<Record<string, number>>;
    features: Readonly<Record<string, number>>;
  };
  readonly metrics;
  private face: Font;
  constructor(face: Font, options: FontOptions = {}) {
    this.face = face;
    const axes = Object.fromEntries(face.axes.map((a) => [a.tag, a.default]));
    for (const [tag, value] of Object.entries(options.axes ?? {})) {
      const axis = face.axes.find((a) => a.tag === tag);
      if (!axis || !Number.isFinite(value))
        fault('unknown or invalid variation axis ' + tag, 'font-axis');
      axes[tag] = Math.max(axis.min, Math.min(axis.max, value));
    }
    const available = featureTags(face);
    const features = Object.fromEntries(
      ['ccmp', 'locl', 'rlig', 'liga', 'clig', 'kern']
        .filter((t) => available.has(t))
        .map((t) => [t, 1]),
    );
    for (const [tag, value] of Object.entries(options.features ?? {})) {
      if (
        !/^[a-zA-Z0-9 ]{4}$/.test(tag) ||
        !Number.isInteger(value) ||
        value < 0 ||
        !available.has(tag)
      )
        fault('unknown or invalid font feature ' + tag, 'font-feature');
      features[tag] = value;
    }
    this.options = Object.freeze({ axes: Object.freeze(axes), features: Object.freeze(features) });
    const { unitsPerEm, ascent, descent, lineGap, capHeight, xHeight, glyphCount } = face;
    this.metrics = Object.freeze({
      unitsPerEm,
      ascent,
      descent,
      lineGap,
      capHeight,
      xHeight,
      glyphCount,
    });
  }
  hasGlyph(codepoint: number | string) {
    return this.face.hasGlyph(codepoint);
  }
  derive(options: FontOptions) {
    return new FontInfo(this.face, {
      axes: { ...this.options.axes, ...options.axes },
      features: { ...this.options.features, ...options.features },
    });
  }
  /** Raw glyph path by index. +Y points down, with baseline zero, like Anima geometry. */
  glyphPath(glyph: number, size = this.metrics.unitsPerEm) {
    if (!Number.isFinite(size) || size < 0) fault('invalid glyph path size');
    return this.face.path(glyph, size, 0, 0, { ...this.options.axes });
  }
  /** Context-free GSUB with the same bounded shaping contract as the tool measurer. */
  glyphs(text: string) {
    return substitute(this.face, text, { ...this.options.features }).map((g) => ({
      ...g,
      advance: this.face.advance(g.glyph, { ...this.options.axes }),
      path: this.glyphPath(g.glyph),
    }));
  }
}
/** Browser-neutral SFNT decoder. Compressed web containers must be normalized by the tool. */
export function decodeFont(bytes: Uint8Array): FontInfo {
  if (bytes.byteLength > MAX_FONT) fault('font exceeds the 32 MiB limit', 'font-limit');
  const b = new Bytes(Uint8Array.from(bytes));
  const flavor = b.u32(0);
  if (![0x10000, 0x4f54544f, 0x74727565].includes(flavor))
    fault('introspection requires SFNT TTF or OTF bytes', 'font-format');
  const n = b.u16(4),
    tables = new Map<string, Uint8Array>();
  if (!n || n > 256) fault('invalid sfnt table count');
  for (let i = 0; i < n; i++) {
    const p = 12 + i * 16,
      tag = b.tag(p);
    if (tables.has(tag)) fault('duplicate font table ' + tag);
    tables.set(tag, b.slice(b.u32(p + 8), b.u32(p + 12)));
  }
  return new FontInfo(new Font({ tables, flavor }));
}
