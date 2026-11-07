import { fault } from './binary.ts';
import type { Contour } from './reader.ts';

/** Unhinted, uncompressed TrueType simple glyph, with explicit signed coordinate deltas. */
export function encodeGlyph(
  contours: Contour[],
  instructions: Buffer = Buffer.alloc(0),
  overlap = false,
): Buffer {
  const points = contours.flat();
  if (!points.length) return Buffer.alloc(0);
  const n = points.length;
  if (n > 65535 || contours.length > 32767) fault('glyph point limit', 'font-limit');
  const out = Buffer.alloc(12 + contours.length * 2 + n * 5 + instructions.length);
  out.writeInt16BE(contours.length, 0);
  const xs = points.map((p) => Math.round(p.x)),
    ys = points.map((p) => Math.round(p.y));
  [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].forEach((v, i) =>
    out.writeInt16BE(v, 2 + i * 2),
  );
  let p = 10,
    end = -1;
  contours.forEach((c) => {
    end += c.length;
    out.writeUInt16BE(end, p);
    p += 2;
  });
  out.writeUInt16BE(instructions.length, p);
  p += 2;
  instructions.copy(out, p);
  p += instructions.length;
  points.forEach((pt, i) => (out[p++] = (pt.on ? 1 : 0) | (overlap && i === 0 ? 64 : 0)));
  for (const values of [xs, ys]) {
    let prev = 0;
    for (const v of values) {
      const delta = v - prev;
      if (delta < -32768 || delta > 32767) fault('glyph delta outside int16 range');
      out.writeInt16BE(delta, p);
      p += 2;
      prev = v;
    }
  }
  return out;
}
