import { VERBOSE as V } from '../../../../packages/core/src/flags.ts';
import type { Font, Point } from './reader.ts';
import { Bytes, fault } from './binary.ts';

/** OpenType gvar tuple deltas, shared/private points, intermediate regions and IUP. */
export function varyPoints(
  font: Font,
  glyph: number,
  points: Point[],
  contourLengths: number[],
  axes: Record<string, number>,
): Point[] {
  for (const value of Object.values(axes))
    if (!Number.isFinite(value)) fault(V ? 'nonfinite variation coordinate' : '');
  const coords = font.axes.map((a) => {
    const x = Math.max(a.min, Math.min(a.max, axes[a.tag] ?? a.default));
    return x === a.default
      ? 0
      : x < a.default
        ? (x - a.default) / (a.default - a.min)
        : (x - a.default) / (a.max - a.default);
  });
  if (coords.every((x) => x === 0)) return points;
  if (font.tables.has('avar')) {
    const a = font.table('avar');
    if (a.u16(6) !== coords.length) fault(V ? 'avar axis count mismatch' : '');
    let p = 8;
    coords.forEach((v, i) => {
      const n = a.u16(p);
      p += 2;
      let lastX = -1,
        lastY = -1;
      for (let j = 0; j < n; j++) {
        const x = a.i16(p) / 16384,
          y = a.i16(p + 2) / 16384;
        p += 4;
        if (v >= lastX && v <= x) {
          coords[i] = x === lastX ? y : lastY + ((v - lastX) / (x - lastX)) * (y - lastY);
        }
        lastX = x;
        lastY = y;
      }
    });
  }
  const b = font.table('gvar'),
    n = b.u16(4);
  if (n !== coords.length || b.u16(12) !== font.glyphCount)
    fault(V ? 'gvar axis/glyph count mismatch' : '');
  const long = !!(b.u16(14) & 1),
    offset = (id: number) => (long ? b.u32(20 + id * 4) : b.u16(20 + id * 2) * 2);
  const start = b.u32(16) + offset(glyph),
    end = b.u32(16) + offset(glyph + 1);
  if (start === end) return points;
  const g = new Bytes(b.slice(start, end - start)),
    count = g.u16(0),
    tuples = count & 4095;
  if (tuples * points.length > 8_000_000)
    fault(V ? 'glyph variation operation limit' : '', 'font-limit');
  let header = 4,
    data = g.u16(2);
  const tuple = (p: number) => coords.map((_, i) => g.i16(p + i * 2) / 16384);
  const headers: {
    size: number;
    flags: number;
    peak: number[];
    start?: number[];
    end?: number[];
  }[] = [];
  for (let i = 0; i < tuples; i++) {
    const size = g.u16(header),
      flags = g.u16(header + 2);
    header += 4;
    let peak: number[];
    if (flags & 0x8000) {
      peak = tuple(header);
      header += n * 2;
    } else {
      const index = flags & 4095;
      if (index >= b.u16(6)) fault(V ? 'invalid gvar shared tuple' : '');
      peak = coords.map((_, j) => b.i16(b.u32(8) + (index * n + j) * 2) / 16384);
    }
    let lower: number[] | undefined, upper: number[] | undefined;
    if (flags & 0x4000) {
      lower = tuple(header);
      header += n * 2;
      upper = tuple(header);
      header += n * 2;
    }
    headers.push({ size, flags, peak, start: lower, end: upper });
  }
  if (header > data) fault(V ? 'overlapping gvar headers' : '');
  const packedPoints = (r: Bytes, cursor: { p: number }): number[] | undefined => {
    let count = r.u8(cursor.p++);
    if (!count) return undefined;
    if (count & 128) count = ((count & 127) << 8) | r.u8(cursor.p++);
    if (count > points.length) fault(V ? 'too many gvar points' : '');
    const out: number[] = [];
    let point = 0;
    while (out.length < count) {
      const control = r.u8(cursor.p++),
        run = (control & 127) + 1;
      if (out.length + run > count) fault(V ? 'invalid gvar point run' : '');
      for (let i = 0; i < run; i++) {
        point += control & 128 ? r.u16(cursor.p) : r.u8(cursor.p);
        cursor.p += control & 128 ? 2 : 1;
        if (point >= points.length) fault(V ? 'gvar point out of range' : '');
        out.push(point);
      }
    }
    return out;
  };
  let shared: number[] | undefined;
  if (count & 0x8000) {
    const cursor = { p: data };
    shared = packedPoints(g, cursor);
    data = cursor.p;
  }
  const output = points.map((p) => ({ ...p }));
  for (const h of headers) {
    const t = new Bytes(g.slice(data, h.size));
    data += h.size;
    let scalar = 1;
    coords.forEach((c, i) => {
      const peak = h.peak[i]!;
      if (!peak) return;
      if (h.start && h.end) {
        const lo = h.start[i]!,
          hi = h.end[i]!;
        if (lo > peak || peak > hi || (lo < 0 && hi > 0)) return;
        if (c < lo || c > hi) scalar = 0;
        else if (c < peak) scalar *= (c - lo) / (peak - lo);
        else if (c > peak) scalar *= (hi - c) / (hi - peak);
      } else if (c === 0 || c * peak < 0) scalar = 0;
      else if (Math.abs(c) < Math.abs(peak)) scalar *= c / peak;
    });
    const cursor = { p: 0 },
      indices = h.flags & 0x2000 ? packedPoints(t, cursor) : shared,
      number = indices?.length ?? points.length;
    const unpack = () => {
      const deltas: number[] = [];
      while (deltas.length < number) {
        const control = t.u8(cursor.p++),
          run = (control & 63) + 1;
        if (deltas.length + run > number) fault(V ? 'invalid gvar delta run' : '');
        for (let i = 0; i < run; i++) {
          deltas.push(control & 128 ? 0 : control & 64 ? t.i16(cursor.p) : t.i8(cursor.p));
          if (!(control & 128)) cursor.p += control & 64 ? 2 : 1;
        }
      }
      return deltas;
    };
    const dx = unpack(),
      dy = unpack();
    if (!scalar) continue;
    const delta: ([number, number] | undefined)[] = Array(points.length);
    for (let i = 0; i < number; i++) delta[indices?.[i] ?? i] = [dx[i]!, dy[i]!];
    if (indices) {
      let first = 0;
      for (const length of contourLengths) {
        const touched: number[] = [];
        for (let i = first; i < first + length; i++) if (delta[i]) touched.push(i);
        if (touched.length === 1) {
          for (let i = first; i < first + length; i++) delta[i] = delta[touched[0]!]!;
        } else if (touched.length > 1) {
          for (let j = 0; j < touched.length; j++) {
            const a = touched[j]!,
              z = touched[(j + 1) % touched.length]!;
            let i = first + ((a - first + 1) % length);
            while (i !== z) {
              const d: [number, number] = [0, 0];
              for (const [k, key] of ['x', 'y'].entries()) {
                let c1 = points[a]![key as 'x' | 'y'],
                  c2 = points[z]![key as 'x' | 'y'],
                  v1 = delta[a]![k]!,
                  v2 = delta[z]![k]!;
                if (c1 > c2) {
                  [c1, c2] = [c2, c1];
                  [v1, v2] = [v2, v1];
                }
                const c = points[i]![key as 'x' | 'y'];
                d[k as 0 | 1] =
                  c1 === c2
                    ? v1 === v2
                      ? v1
                      : 0
                    : c <= c1
                      ? v1
                      : c >= c2
                        ? v2
                        : v1 + ((c - c1) / (c2 - c1)) * (v2 - v1);
              }
              delta[i] = d;
              i = first + ((i - first + 1) % length);
            }
          }
        }
        first += length;
      }
    }
    delta.forEach((d, i) => {
      if (d) {
        output[i]!.x += d[0] * scalar;
        output[i]!.y += d[1] * scalar;
      }
    });
  }
  return output;
}
