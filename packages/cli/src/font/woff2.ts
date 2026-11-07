import { Bytes, fault, MAX_FONT } from './binary.ts';
import type { Contour } from './reader.ts';
import { encodeGlyph } from './truetype.ts';

class Stream {
  b: Bytes;
  p = 0;
  constructor(data: Buffer) {
    this.b = new Bytes(data);
  }
  u8() {
    return this.b.u8(this.p++);
  }
  u16() {
    const v = this.b.u16(this.p);
    this.p += 2;
    return v;
  }
  i16() {
    const v = this.b.i16(this.p);
    this.p += 2;
    return v;
  }
  take(n: number) {
    const v = this.b.slice(this.p, n);
    this.p += n;
    return v;
  }
  uint255() {
    const c = this.u8();
    return c === 253 ? this.u16() : c === 255 ? this.u8() + 253 : c === 254 ? this.u8() + 506 : c;
  }
}
/** W3C WOFF2 §5.1–5.4 inverse transforms, producing canonical sfnt tables. */
export function restoreGlyf(tables: Map<string, Buffer>, expectedLoca: number): void {
  const b = new Bytes(tables.get('glyf') ?? fault('missing transformed glyf'));
  if (b.u16(0) !== 0 || b.u16(2) > 1) fault('unsupported WOFF2 glyf version', 'font-unsupported');
  const count = b.u16(4),
    format = b.u16(6);
  if (format > 1 || expectedLoca !== (count + 1) * (format ? 4 : 2))
    fault('invalid transformed loca size');
  let p = 36;
  const streams: Stream[] = [];
  for (let i = 0; i < 7; i++) {
    const n = b.u32(8 + i * 4);
    streams.push(new Stream(b.slice(p, n)));
    p += n;
  }
  const [nContours, nPoints, flags, glyph, composite, boxes, instructions] = streams as [
    Stream,
    Stream,
    Stream,
    Stream,
    Stream,
    Stream,
    Stream,
  ];
  const bitmap = boxes.take(4 * Math.floor((count + 31) / 32)),
    overlap = b.u16(2) & 1 ? b.slice(p, Math.ceil(count / 8)) : undefined;
  const locations: number[] = [],
    glyphs: Buffer[] = [];
  let offset = 0;
  for (let id = 0; id < count; id++) {
    locations.push(offset);
    const nc = nContours.i16(),
      hasBox = !!(bitmap[id >> 3]! & (128 >> (id & 7)));
    let raw: Buffer;
    if (!nc) {
      if (hasBox) fault('empty WOFF2 glyph has a bounding box');
      raw = Buffer.alloc(0);
    } else if (nc > 0) {
      const contours: Contour[] = [],
        lengths: number[] = [];
      let total = 0;
      for (let i = 0; i < nc; i++) {
        const n = nPoints.uint255();
        total += n;
        if (!n || total > 65535) fault('invalid WOFF2 point count');
        lengths.push(n);
      }
      let x = 0,
        y = 0;
      for (const length of lengths) {
        const contour: Contour = [];
        for (let j = 0; j < length; j++) {
          const flag = flags.u8(),
            f = flag & 127;
          let dx = 0,
            dy = 0;
          const sign = (n: number, positive: number) => (positive ? n : -n);
          if (f < 10) dy = sign(((f & 14) << 7) + glyph.u8(), f & 1);
          else if (f < 20) dx = sign((((f - 10) & 14) << 7) + glyph.u8(), f & 1);
          else if (f < 84) {
            const a = f - 20,
              v = glyph.u8();
            dx = sign(1 + (a & 48) + (v >> 4), f & 1);
            dy = sign(1 + ((a & 12) << 2) + (v & 15), f & 2);
          } else if (f < 120) {
            const a = f - 84;
            dx = sign(1 + Math.floor(a / 12) * 256 + glyph.u8(), f & 1);
            dy = sign(1 + Math.floor((a % 12) / 4) * 256 + glyph.u8(), f & 2);
          } else if (f < 124) {
            const a = glyph.u8(),
              c = glyph.u8(),
              d = glyph.u8();
            dx = sign(a * 16 + (c >> 4), f & 1);
            dy = sign((c & 15) * 256 + d, f & 2);
          } else {
            dx = sign(glyph.u16(), f & 1);
            dy = sign(glyph.u16(), f & 2);
          }
          x += dx;
          y += dy;
          if (x < -32768 || x > 32767 || y < -32768 || y > 32767)
            fault('WOFF2 coordinate overflow');
          contour.push({ x, y, on: !(flag & 128) });
        }
        contours.push(contour);
      }
      const length = glyph.uint255();
      raw = encodeGlyph(
        contours,
        instructions.take(length),
        !!(overlap?.[id >> 3] && overlap[id >> 3]! & (128 >> (id & 7))),
      );
      if (hasBox) boxes.take(8).copy(raw, 2);
    } else if (nc === -1) {
      if (!hasBox) fault('WOFF2 composite is missing bbox');
      let more = true,
        hasInstructions = false;
      const parts: Buffer[] = [];
      while (more) {
        const f = composite.u16(),
          n = 2 + (f & 1 ? 4 : 2) + (f & 8 ? 2 : f & 64 ? 4 : f & 128 ? 8 : 0),
          part = Buffer.alloc(2 + n);
        part.writeUInt16BE(f);
        composite.take(n).copy(part, 2);
        parts.push(part);
        more = !!(f & 32);
        hasInstructions ||= !!(f & 256);
      }
      const head = Buffer.alloc(10);
      head.writeInt16BE(-1);
      boxes.take(8).copy(head, 2);
      parts.unshift(head);
      if (hasInstructions) {
        const n = glyph.uint255(),
          len = Buffer.alloc(2);
        len.writeUInt16BE(n);
        parts.push(len, instructions.take(n));
      }
      raw = Buffer.concat(parts);
    } else return fault('invalid WOFF2 contour count');
    // Short loca uses two-byte units; long loca needs no padding, but deterministic padding is harmless.
    if (raw.length & 1) raw = Buffer.concat([raw, Buffer.alloc(1)]);
    glyphs.push(raw);
    offset += raw.length;
    if (offset > MAX_FONT) fault('reconstructed WOFF2 exceeds size limit', 'font-limit');
    if (!format && offset > 131070) fault('reconstructed WOFF2 short loca overflows');
  }
  locations.push(offset);
  for (const s of streams)
    if (s.p !== s.b.data.length) fault('WOFF2 transformed stream length mismatch');
  const loca = Buffer.alloc(expectedLoca);
  locations.forEach((v, i) =>
    format ? loca.writeUInt32BE(v, i * 4) : loca.writeUInt16BE(v / 2, i * 2),
  );
  tables.set('glyf', Buffer.concat(glyphs));
  tables.set('loca', loca);
  const head = Buffer.from(tables.get('head') ?? fault('missing head'));
  head.writeInt16BE(format, 50);
  tables.set('head', head);
}
export function restoreHmtx(tables: Map<string, Buffer>): void {
  const b = new Stream(tables.get('hmtx') ?? fault('missing hmtx')),
    flags = b.u8();
  if (flags < 1 || flags > 3) fault('invalid WOFF2 hmtx flags');
  const head = new Bytes(tables.get('head') ?? fault('missing head')),
    maxp = new Bytes(tables.get('maxp') ?? fault('missing maxp')),
    hhea = new Bytes(tables.get('hhea') ?? fault('missing hhea')),
    loca = new Bytes(tables.get('loca') ?? fault('missing loca')),
    glyf = new Bytes(tables.get('glyf') ?? fault('missing glyf'));
  const count = maxp.u16(4),
    n = hhea.u16(34);
  if (!n || n > count) fault('invalid WOFF2 metric count');
  const out = Buffer.alloc(n * 4 + (count - n) * 2),
    long = head.i16(50),
    offset = (i: number) => (long ? loca.u32(i * 4) : loca.u16(i * 2) * 2);
  for (let i = 0; i < n; i++) out.writeUInt16BE(b.u16(), i * 4);
  for (let i = 0; i < count; i++) {
    const omitted = i < n ? flags & 1 : flags & 2;
    const value = omitted ? (offset(i) === offset(i + 1) ? 0 : glyf.i16(offset(i) + 2)) : b.i16();
    out.writeInt16BE(value, i < n ? i * 4 + 2 : n * 4 + (i - n) * 2);
  }
  if (b.p !== b.b.data.length) fault('WOFF2 hmtx length mismatch');
  tables.set('hmtx', out);
}
