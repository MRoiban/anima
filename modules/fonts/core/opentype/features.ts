import { VERBOSE as V } from '../../../../packages/core/src/flags.ts';
// OpenType GSUB, authored from https://learn.microsoft.com/en-us/typography/opentype/spec/gsub.
// Deliberately bounded, context-free subset; never pretend that contextual shaping succeeded.
import { Bytes, fault } from './binary.ts';
import type { Font } from './reader.ts';
export type ShapedGlyph = { glyph: number; start: number; end: number };
export function featureTags(font: Font): Set<string> {
  const tags = new Set<string>(font.tables.has('kern') ? ['kern'] : []);
  for (const table of ['GSUB', 'GPOS']) {
    if (!font.tables.has(table)) continue;
    const b = font.table(table),
      list = b.u16(6);
    for (let i = 0; i < b.u16(list); i++) tags.add(b.tag(list + 2 + i * 6));
  }
  return tags;
}
function coverage(b: Bytes, at: number, glyph: number): number {
  const kind = b.u16(at),
    n = b.u16(at + 2);
  for (let i = 0; i < n; i++) {
    if (kind === 1) {
      if (b.u16(at + 4 + i * 2) === glyph) return i;
    } else if (kind === 2) {
      const p = at + 4 + i * 6,
        lo = b.u16(p),
        hi = b.u16(p + 2);
      if (glyph >= lo && glyph <= hi) return b.u16(p + 4) + glyph - lo;
    } else fault(V ? 'unsupported GSUB coverage' : '', 'font-unsupported');
  }
  return -1;
}
export function substitute(
  font: Font,
  text: string,
  features: Record<string, number> = {},
): ShapedGlyph[] {
  let offset = 0;
  const glyphs = [...text].map((char) => {
    const start = offset;
    offset += char.length;
    return { glyph: font.glyph(char.codePointAt(0)!), start, end: offset };
  });
  if (!font.tables.has('GSUB')) return glyphs;
  const b = font.table('GSUB'),
    list = b.u16(8),
    f = b.u16(6),
    selected = new Map<number, number>();
  for (let i = 0; i < b.u16(f); i++) {
    const p = f + 2 + i * 6,
      tag = b.tag(p);
    const value = features[tag] ?? (['ccmp', 'locl', 'rlig', 'liga', 'clig'].includes(tag) ? 1 : 0);
    if (!value) continue;
    const entry = f + b.u16(p + 4);
    for (let j = 0; j < b.u16(entry + 2); j++) selected.set(b.u16(entry + 4 + j * 2), value);
  }
  // Font lookup order, independent of authored feature-map order.
  for (const [index, value] of [...selected].sort(([a], [c]) => a - c)) {
    if (index >= b.u16(list)) fault(V ? 'invalid GSUB lookup index' : '');
    const lookup = list + b.u16(list + 2 + index * 2),
      type = b.u16(lookup);
    if (b.u16(lookup + 2))
      fault(
        V ? 'GSUB lookup flags need complex shaping; use --browser-text' : '',
        'font-unsupported',
      );
    for (let i = 0; i < glyphs.length; i++) {
      for (let j = 0; j < b.u16(lookup + 4); j++) {
        let p = lookup + b.u16(lookup + 6 + j * 2),
          kind = type;
        if (kind === 7) {
          if (b.u16(p) !== 1) fault(V ? 'invalid GSUB extension' : '');
          kind = b.u16(p + 2);
          p += b.u32(p + 4);
        }
        if (![1, 3, 4].includes(kind))
          fault(
            V ? 'GSUB lookup needs contextual shaping; use --browser-text' : '',
            'font-unsupported',
          );
        const format = b.u16(p),
          ci = coverage(b, p + b.u16(p + 2), glyphs[i]!.glyph);
        if (ci < 0) continue;
        if (kind === 1) {
          if (format === 1) glyphs[i]!.glyph = (glyphs[i]!.glyph + b.i16(p + 4)) & 65535;
          else if (format === 2 && ci < b.u16(p + 4)) glyphs[i]!.glyph = b.u16(p + 6 + ci * 2);
          else fault(V ? 'invalid GSUB single substitution' : '');
        } else {
          if (format !== 1 || ci >= b.u16(p + 4)) fault(V ? 'invalid GSUB set index' : '');
          const set = p + b.u16(p + 6 + ci * 2),
            count = b.u16(set);
          if (kind === 3) {
            if (value <= count) glyphs[i]!.glyph = b.u16(set + value * 2);
          } else {
            let matched = false;
            for (let k = 0; k < count; k++) {
              const lig = set + b.u16(set + 2 + k * 2),
                n = b.u16(lig + 2);
              if (n < 2) fault(V ? 'invalid GSUB ligature component count' : '');
              if (i + n > glyphs.length) continue;
              let same = true;
              for (let c = 1; c < n; c++)
                if (glyphs[i + c]!.glyph !== b.u16(lig + 2 + c * 2)) same = false;
              if (!same) continue;
              glyphs.splice(i, n, {
                glyph: b.u16(lig),
                start: glyphs[i]!.start,
                end: glyphs[i + n - 1]!.end,
              });
              matched = true;
              break;
            }
            if (!matched) continue;
          }
        }
        if (glyphs[i]!.glyph >= font.glyphCount) fault(V ? 'GSUB glyph index out of range' : '');
        break; // One matching subtable per glyph per lookup.
      }
    }
  }
  return glyphs;
}
