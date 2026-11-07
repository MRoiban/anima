import { inflateSync, brotliDecompressSync } from 'node:zlib';
import { restoreGlyf, restoreHmtx } from './woff2.ts';
import { Bytes, fault, MAX_FONT, sfnt } from './binary.ts';

const TAGS =
  'cmap head hhea hmtx maxp name OS/2 post cvt_ fpgm glyf loca prep CFF_ VORG EBDT EBLC gasp hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG_ sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill'
    .split(' ')
    .map((t) => t.replaceAll('_', ' '));
export function unpack(input: Uint8Array): { tables: Map<string, Buffer>; flavor: number } {
  if (input.length > MAX_FONT) fault('font exceeds the 32 MiB tool limit', 'font-limit');
  // Snapshot once; table/glyph readers then use bounded zero-copy views.
  const b = new Bytes(Buffer.from(input)),
    tag = b.tag(0);
  const tables = new Map<string, Buffer>();
  const put = (tag: string, bytes: Buffer) => {
    if (tables.has(tag)) fault('duplicate font table ' + tag);
    tables.set(tag, bytes);
  };
  if (tag === 'wOFF') {
    if (b.u32(8) !== input.length || b.u32(16) > MAX_FONT) fault('invalid WOFF length');
    const n = b.u16(12);
    if (n > 256) fault('too many font tables', 'font-limit');
    let total = 0;
    for (let i = 0; i < n; i++) {
      const p = 44 + i * 20,
        len = b.u32(p + 12),
        compressed = b.u32(p + 8);
      total += len;
      if (total > MAX_FONT) fault('WOFF exceeds decompression limit', 'font-limit');
      if (compressed > len || len > MAX_FONT) fault('invalid WOFF table length');
      const bytes = b.slice(b.u32(p + 4), compressed);
      const data = compressed === len ? bytes : inflateSync(bytes, { maxOutputLength: len });
      if (data.length !== len) fault('WOFF decompressed length mismatch');
      put(b.tag(p), data);
    }
    return { tables, flavor: b.u32(4) };
  }
  if (tag === 'wOF2') {
    if (b.u32(8) !== input.length || b.u32(16) > MAX_FONT) fault('invalid WOFF2 length');
    const n = b.u16(12);
    if (n > 256) fault('too many font tables', 'font-limit');
    let pos = 48;
    const base128 = () => {
      let v = 0;
      for (let i = 0; i < 5; i++) {
        const x = b.u8(pos++);
        if ((!i && x === 128) || v > 0x1ffffff) fault('invalid WOFF2 UIntBase128');
        v = v * 128 + (x & 127);
        if (!(x & 128)) return v;
      }
      return fault('invalid WOFF2 UIntBase128');
    };
    const entries: { tag: string; len: number; stored: number; transform: number }[] = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const flags = b.u8(pos++),
        tag = (flags & 63) === 63 ? ((pos += 4), b.tag(pos - 4)) : TAGS[flags & 63]!;
      const len = base128(),
        version = flags >> 6,
        transformed = tag === 'glyf' || tag === 'loca' ? version !== 3 : version !== 0;
      const stored = transformed ? base128() : len;
      total += stored;
      if (total > MAX_FONT) fault('WOFF2 exceeds decompression limit', 'font-limit');
      entries.push({ tag, len, stored, transform: transformed ? version + 1 : 0 });
    }
    const data = brotliDecompressSync(b.slice(pos, b.u32(20)), {
      maxOutputLength: Math.max(1, total),
    });
    if (data.length !== total) fault('WOFF2 decompressed length mismatch');
    let p = 0;
    for (const entry of entries) {
      put(entry.tag, data.subarray(p, p + entry.stored));
      p += entry.stored;
    }
    for (const e of entries)
      if (
        e.transform &&
        !(
          ((e.tag === 'glyf' || e.tag === 'loca') && e.transform === 1) ||
          (e.tag === 'hmtx' && e.transform === 2)
        )
      )
        fault('unsupported WOFF2 transform', 'font-unsupported');
    const glyf = entries.find((e) => e.tag === 'glyf'),
      loca = entries.find((e) => e.tag === 'loca');
    if (!!glyf?.transform !== !!loca?.transform) fault('WOFF2 glyf/loca transform mismatch');
    if (glyf?.transform) {
      if (loca!.stored !== 0) fault('transformed loca must be empty');
      restoreGlyf(tables, loca!.len);
    }
    if (entries.some((e) => e.tag === 'hmtx' && e.transform)) restoreHmtx(tables);
    return { tables, flavor: b.u32(4) };
  }
  const flavor = b.u32(0);
  if (flavor !== 0x10000 && tag !== 'OTTO' && tag !== 'true')
    fault('expected TTF, OTF, WOFF or WOFF2', 'font-format');
  const n = b.u16(4);
  if (!n || n > 256) fault('invalid sfnt table count');
  for (let i = 0; i < n; i++) {
    const p = 12 + i * 16;
    put(b.tag(p), b.slice(b.u32(p + 8), b.u32(p + 12)));
  }
  return { tables, flavor };
}
export function normalizeFont(bytes: Uint8Array): Buffer {
  const { tables, flavor } = unpack(bytes);
  return sfnt(tables, flavor);
}
