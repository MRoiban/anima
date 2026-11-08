import { subsetCFF } from './cff.ts';
import { Bytes, fault, sfnt } from './binary.ts';
import { Font } from './reader.ts';

export function cmap12(coverage: ReadonlyMap<number, number>): Buffer {
  const entries = [...coverage].sort(([a], [b]) => a - b),
    groups: { start: number; end: number; glyph: number }[] = [];
  for (const [cp, glyph] of entries) {
    const last = groups.at(-1);
    if (last && cp === last.end + 1 && glyph === last.glyph + cp - last.start) last.end = cp;
    else groups.push({ start: cp, end: cp, glyph });
  }
  const out = Buffer.alloc(28 + groups.length * 12);
  out.writeUInt16BE(1, 2);
  out.writeUInt16BE(3, 4);
  out.writeUInt16BE(10, 6);
  out.writeUInt32BE(12, 8);
  out.writeUInt16BE(12, 12);
  out.writeUInt32BE(out.length - 12, 16);
  out.writeUInt32BE(groups.length, 24);
  groups.forEach((g, i) => {
    out.writeUInt32BE(g.start, 28 + i * 12);
    out.writeUInt32BE(g.end, 32 + i * 12);
    out.writeUInt32BE(g.glyph, 36 + i * 12);
  });
  return out;
}
/** Preserve glyph IDs (layout/variation references stay valid); remove unused glyf payloads.
 * Composite dependencies are closed transitively. GSUB is retained conservatively: if present,
 * keep all outlines because arbitrary substitutions can introduce unencoded glyphs.
 */
export function subsetFont(bytes: Uint8Array, characters: string): Buffer {
  const font = new Font(bytes),
    tables = new Map(font.tables);
  const keep = new Set<number>([0]),
    coverage = new Map<number, number>();
  for (const char of characters) {
    const cp = char.codePointAt(0)!,
      g = font.glyph(cp);
    if (g) {
      coverage.set(cp, g);
      keep.add(g);
    }
  }
  if (tables.has('GSUB')) for (let i = 0; i < font.glyphCount; i++) keep.add(i);
  if (!tables.has('glyf')) {
    tables.set('CFF ', subsetCFF(font, keep));
    tables.set('cmap', cmap12(coverage));
    tables.delete('DSIG');
    return sfnt(tables, font.flavor);
  }
  const loca = font.table('loca'),
    long = font.table('head').i16(50),
    glyf = font.table('glyf');
  const offset = (g: number) => (long ? loca.u32(g * 4) : loca.u16(g * 2) * 2);
  const visit = (g: number, depth = 0) => {
    if (depth > 16) fault('recursive subset components', 'font-limit');
    const a = offset(g),
      z = offset(g + 1);
    if (a === z) return;
    const b = new Bytes(glyf.slice(a, z - a));
    if (b.i16(0) >= 0) return;
    let p = 10,
      flags: number;
    do {
      flags = b.u16(p);
      const child = b.u16(p + 2);
      if (child >= font.glyphCount) fault('invalid composite glyph');
      p += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 64 ? 4 : flags & 128 ? 8 : 0);
      if (!keep.has(child)) {
        keep.add(child);
        visit(child, depth + 1);
      }
    } while (flags & 32);
  };
  for (const g of [...keep]) visit(g);
  const chunks: Buffer[] = [],
    locations = Buffer.alloc((font.glyphCount + 1) * 4);
  let total = 0;
  for (let i = 0; i < font.glyphCount; i++) {
    locations.writeUInt32BE(total, i * 4);
    if (keep.has(i)) {
      const chunk = glyf.slice(offset(i), offset(i + 1) - offset(i));
      chunks.push(chunk);
      total += chunk.length;
    }
  }
  locations.writeUInt32BE(total, font.glyphCount * 4);
  const head = Buffer.from(tables.get('head')!);
  head.writeInt16BE(1, 50);
  tables.set('head', head);
  tables.set('glyf', Buffer.concat(chunks));
  tables.set('loca', locations);
  tables.set('cmap', cmap12(coverage));
  tables.delete('DSIG');
  return sfnt(tables, font.flavor);
}
