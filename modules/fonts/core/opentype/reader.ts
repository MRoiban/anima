import { VERBOSE as V } from '../../../../packages/core/src/flags.ts';
import { Bytes, fault } from './binary.ts';
import { cffOutline } from './cff.ts';
import { varyPoints } from './variation.ts';

export type GlyphAdjustment = { x: number; y: number; advanceX: number; advanceY: number };
export type PairAdjustment = { first: GlyphAdjustment; second: GlyphAdjustment };
const zeroAdjustment = (): GlyphAdjustment => ({ x: 0, y: 0, advanceX: 0, advanceY: 0 });
export type Point = { x: number; y: number; on: boolean };
export type Contour = Point[];
export type Axis = { tag: string; min: number; default: number; max: number; name: string };
export type Instance = { name: string; axes: Record<string, number> };
export class Font<T extends Uint8Array = Uint8Array> {
  readonly tables: Map<string, T>;
  readonly flavor: number;
  readonly unitsPerEm: number;
  readonly glyphCount: number;
  readonly family: string;
  readonly weight: number;
  readonly style: 'normal' | 'italic';
  readonly ascent: number;
  readonly descent: number;
  readonly lineGap: number;
  readonly capHeight: number;
  readonly xHeight: number;
  readonly axes: Axis[] = [];
  readonly instances: Instance[] = [];
  readonly coverage = new Map<number, number>();
  #locations: number[] = [];
  #metrics: number[] = [];
  constructor(input: { tables: Map<string, T>; flavor: number }) {
    ({ tables: this.tables, flavor: this.flavor } = input);
    const head = this.table('head'),
      maxp = this.table('maxp'),
      hhea = this.table('hhea'),
      hmtx = this.table('hmtx');
    if (head.u32(12) !== 0x5f0f3cf5) fault(V ? 'invalid OpenType head magic' : '');
    this.unitsPerEm = head.u16(18);
    this.glyphCount = maxp.u16(4);
    if (this.unitsPerEm < 16 || this.unitsPerEm > 16384 || !this.glyphCount)
      fault(V ? 'invalid unitsPerEm or glyph count' : '');
    const n = hhea.u16(34);
    if (!n || n > this.glyphCount) fault(V ? 'invalid horizontal metric count' : '');
    hmtx.check(0, n * 4 + (this.glyphCount - n) * 2);
    for (let i = 0; i < this.glyphCount; i++) this.#metrics.push(hmtx.u16(Math.min(i, n - 1) * 4));
    const os = this.tables.has('OS/2') ? this.table('OS/2') : undefined;
    this.weight = os ? os.u16(4) || 400 : 400;
    this.style =
      (os && os.data.length >= 64 && os.u16(62) & 1) || head.u16(44) & 2 ? 'italic' : 'normal';
    const typo = os && os.data.length >= 78 && os.u16(62) & 128;
    this.ascent = typo ? os!.i16(68) : hhea.i16(4);
    this.descent = -(typo ? os!.i16(70) : hhea.i16(6));
    this.lineGap = typo ? os!.i16(72) : hhea.i16(8);
    this.capHeight = os && os.u16(0) >= 2 && os.data.length >= 90 ? os.i16(88) : this.ascent;
    this.xHeight = os && os.u16(0) >= 2 && os.data.length >= 90 ? os.i16(86) : this.ascent / 2;
    this.family = this.name(16) || this.name(1) || 'Unnamed';
    this.#cmap();
    if (this.tables.has('glyf')) {
      const loca = this.table('loca'),
        long = head.i16(50);
      if (long !== 0 && long !== 1) fault(V ? 'invalid loca format' : '');
      for (let i = 0; i <= this.glyphCount; i++) {
        const off = long ? loca.u32(i * 4) : loca.u16(i * 2) * 2;
        if (off > this.tables.get('glyf')!.length || off < (this.#locations[i - 1] ?? 0))
          fault(V ? 'invalid glyph offset' : '');
        this.#locations.push(off);
      }
    } else if (!this.tables.has('CFF '))
      fault(V ? 'no supported glyph outlines' : '', 'font-unsupported');
    if (this.tables.has('fvar')) {
      const f = this.table('fvar'),
        start = f.u16(4),
        n = f.u16(8),
        axisSize = f.u16(10),
        instances = f.u16(12),
        instanceSize = f.u16(14);
      if (n > 64 || axisSize < 20 || instanceSize < 4 + n * 4)
        fault(V ? 'invalid variation records' : '');
      for (let i = 0; i < n; i++) {
        const p = start + i * axisSize;
        const axis = {
          tag: f.tag(p),
          min: f.fixed(p + 4),
          default: f.fixed(p + 8),
          max: f.fixed(p + 12),
          name: this.name(f.u16(p + 18)),
        };
        if (axis.min > axis.default || axis.default > axis.max)
          fault(V ? 'invalid axis range' : '');
        this.axes.push(axis);
      }
      for (let i = 0; i < instances; i++) {
        const p = start + n * axisSize + i * instanceSize;
        this.instances.push({
          name: this.name(f.u16(p)),
          axes: Object.fromEntries(this.axes.map((axis, j) => [axis.tag, f.fixed(p + 4 + j * 4)])),
        });
      }
    }
  }
  table(tag: string): Bytes {
    const b = this.tables.get(tag);
    if (!b) fault('missing font table ' + tag);
    return new Bytes(b);
  }
  // Name records are indexed once (best record per id) and decoded on demand, with a bounded
  // total: overlapping records cannot amplify per-instance lookups.
  #names?: Map<number, string | [number, number, number]>;
  #decoded = 0;
  name(id: number): string {
    if (!this.tables.has('name')) return '';
    const b = this.table('name');
    if (!this.#names) {
      const n = b.u16(2),
        base = b.u16(4),
        ranks = new Map<number, number>();
      this.#names = new Map();
      for (let i = 0; i < n; i++) {
        const p = 6 + i * 12,
          key = b.u16(p + 6),
          platform = b.u16(p),
          rank = (platform === 3 ? 2 : platform === 0 ? 1 : 0) + (b.u16(p + 4) === 0x409 ? 2 : 0);
        if (rank > (ranks.get(key) ?? -1)) {
          ranks.set(key, rank);
          this.#names.set(key, [platform, base + b.u16(p + 10), b.u16(p + 8)]);
        }
      }
    }
    const entry = this.#names.get(id);
    if (entry === undefined || typeof entry === 'string') return entry ?? '';
    const [platform, offset, length] = entry,
      raw = b.slice(offset, length);
    if ((this.#decoded += length) > 1 << 20) fault(V ? 'font name limit' : '', 'font-limit');
    const s =
      platform === 3 || platform === 0
        ? [...Array(Math.floor(raw.length / 2))]
            .map((_, j) => String.fromCharCode(raw[j * 2]! * 256 + raw[j * 2 + 1]!))
            .join('')
        : Array.from(raw, (v) => String.fromCharCode(v)).join('');
    this.#names.set(id, s);
    return s;
  }
  #cmap(): void {
    const b = this.table('cmap'),
      n = b.u16(2);
    const offsets = new Set<number>();
    for (let i = 0; i < n; i++) offsets.add(b.u32(4 + i * 8 + 4));
    const supported = [...offsets]
      .filter((p) => [4, 12].includes(b.u16(p)))
      .sort((a, c) => b.u16(a) - b.u16(c));
    if (!supported.length) fault(V ? 'font needs cmap format 4 or 12' : '', 'font-unsupported');
    const put = (cp: number, g: number) => {
      b.check(0, 0); // charge every mapping: repeated subtables cannot bypass the operation limit
      if (cp > 0x10ffff || g >= this.glyphCount) fault(V ? 'invalid cmap mapping' : '');
      if (g) this.coverage.set(cp, g);
    };
    for (const p of supported) {
      const kind = b.u16(p),
        length = kind === 4 ? b.u16(p + 2) : b.u32(p + 4);
      b.check(p, length);
      const t = new Bytes(b.slice(p, length));
      if (kind === 12) {
        const groups = t.u32(12);
        if (groups > 0x110000) fault(V ? 'cmap group limit' : '', 'font-limit');
        let previous = -1;
        for (let i = 0; i < groups; i++) {
          const q = 16 + i * 12,
            start = t.u32(q),
            end = t.u32(q + 4),
            g = t.u32(q + 8);
          if (start > end || end > 0x10ffff || start <= previous)
            fault(V ? 'invalid cmap group' : '');
          previous = end;
          for (let cp = start; cp <= end; cp++) put(cp, g + cp - start);
        }
      } else {
        const count = t.u16(6) / 2;
        if (!Number.isInteger(count) || !count) fault(V ? 'invalid cmap segments' : '');
        let previous = -1;
        for (let i = 0; i < count; i++) {
          const end = t.u16(14 + i * 2),
            start = t.u16(16 + count * 2 + i * 2),
            delta = t.i16(16 + count * 4 + i * 2),
            at = 16 + count * 6 + i * 2,
            range = t.u16(at);
          if (start > end || start <= previous) fault(V ? 'invalid cmap segment' : '');
          previous = end;
          for (let cp = start; cp <= end && cp !== 65535; cp++) {
            let g = range ? t.u16(at + range + (cp - start) * 2) : cp;
            if (!range || g) g = (g + delta) & 65535;
            put(cp, g);
          }
        }
      }
    }
  }
  glyph(codepoint: number): number {
    return this.coverage.get(codepoint) ?? 0;
  }
  hasGlyph(codepoint: number | string): boolean {
    return (
      this.glyph(typeof codepoint === 'string' ? (codepoint.codePointAt(0) ?? 0) : codepoint) !== 0
    );
  }
  advance(glyph: number, axes: Record<string, number> = {}): number {
    if (glyph < 0 || glyph >= this.glyphCount) fault(V ? 'glyph index out of range' : '');
    let advance = this.#metrics[glyph]!;
    if (this.axes.every((a) => (axes[a.tag] ?? a.default) === a.default)) return advance;
    if (this.tables.has('HVAR') && this.axes.some((a) => (axes[a.tag] ?? a.default) !== a.default))
      fault(V ? 'HVAR advance variations are not implemented' : '', 'font-unsupported');
    if (this.tables.has('gvar') && this.axes.length) {
      const contours = this.contours(glyph, {}, 0, false);
      let points = contours.flat();
      let lengths = contours.map((c) => c.length);
      if (this.tables.has('glyf') && this.#locations[glyph] !== this.#locations[glyph + 1]) {
        const b = new Bytes(
          this.table('glyf').slice(
            this.#locations[glyph]!,
            this.#locations[glyph + 1]! - this.#locations[glyph]!,
          ),
        );
        if (b.i16(0) < 0) {
          let p = 10,
            flags: number,
            components = 0;
          do {
            flags = b.u16(p);
            p += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 64 ? 4 : flags & 128 ? 8 : 0);
            components++;
          } while (flags & 32);
          points = Array.from({ length: components }, () => ({ x: 0, y: 0, on: true }));
          lengths = [];
        }
      }
      const varied = varyPoints(
        this,
        glyph,
        [
          ...points,
          { x: 0, y: 0, on: true },
          { x: advance, y: 0, on: true },
          { x: 0, y: this.ascent, on: true },
          { x: 0, y: -this.descent, on: true },
        ],
        lengths,
        axes,
      );
      advance = varied[points.length + 1]!.x - varied[points.length]!.x;
    }
    return advance;
  }
  kerning(left: number, right: number, features: Record<string, number> = {}): number {
    if (features.kern === 0) return 0;
    if (this.tables.has('GPOS')) {
      const k = pairAdjustment(this, left, right);
      if (k !== undefined) return k.first.advanceX + k.second.advanceX;
    }
    if (!this.tables.has('kern')) return 0;
    const b = this.table('kern');
    if (b.u16(0) !== 0) return 0;
    let p = 4,
      value = 0;
    for (let i = 0; i < b.u16(2); i++) {
      const len = b.u16(p + 2),
        coverage = b.u16(p + 4);
      if (len < 6) fault(V ? 'invalid kern length' : '');
      b.check(p, len);
      if (coverage === 1 || coverage === 9) {
        const count = b.u16(p + 6);
        if (14 + count * 6 > len) fault(V ? 'kern pair data exceeds subtable' : '');
        for (let j = 0; j < count; j++) {
          const q = p + 14 + j * 6;
          if (b.u16(q) === left && b.u16(q + 2) === right) {
            const v = b.i16(q + 4);
            value = coverage & 8 ? v : value + v;
            break;
          }
        }
      }
      p += len;
    }
    return value;
  }
  positionPair(left: number, right: number, features: Record<string, number> = {}): PairAdjustment {
    if (features.kern === 0) return { first: zeroAdjustment(), second: zeroAdjustment() };
    if (this.tables.has('GPOS')) {
      const pair = pairAdjustment(this, left, right);
      if (pair) return pair;
    }
    return {
      first: { ...zeroAdjustment(), advanceX: this.kerning(left, right, features) },
      second: zeroAdjustment(),
    };
  }
  contours(
    glyph: number,
    axes: Record<string, number> = {},
    depth = 0,
    variation = true,
    budget = { points: 250_000, components: 4096 },
  ): Contour[] {
    if (depth > 16) fault(V ? 'recursive glyph components exceed limit' : '', 'font-limit');
    if (glyph < 0 || glyph >= this.glyphCount) fault(V ? 'glyph index out of range' : '');
    if (!this.tables.has('glyf')) return [];
    const start = this.#locations[glyph]!,
      end = this.#locations[glyph + 1]!;
    if (start === end) return [];
    const b = new Bytes(this.table('glyf').slice(start, end - start)),
      count = b.i16(0);
    let p = 10;
    if (count < -1) fault(V ? 'invalid composite contour count' : '');
    if (count < 0) {
      const contours: Contour[] = [],
        components: Contour[][] = [];
      let flags: number;
      do {
        flags = b.u16(p);
        const id = b.u16(p + 2);
        p += 4;
        let a: number, c: number;
        if (flags & 1) {
          a = flags & 2 ? b.i16(p) : b.u16(p);
          c = flags & 2 ? b.i16(p + 2) : b.u16(p + 2);
          p += 4;
        } else {
          a = flags & 2 ? b.i8(p) : b.u8(p);
          c = flags & 2 ? b.i8(p + 1) : b.u8(p + 1);
          p += 2;
        }
        let xx = 1,
          yy = 1,
          xy = 0,
          yx = 0;
        if (flags & 8) {
          xx = yy = b.i16(p) / 16384;
          p += 2;
        } else if (flags & 64) {
          xx = b.i16(p) / 16384;
          yy = b.i16(p + 2) / 16384;
          p += 4;
        } else if (flags & 128) {
          xx = b.i16(p) / 16384;
          yx = b.i16(p + 2) / 16384;
          xy = b.i16(p + 4) / 16384;
          yy = b.i16(p + 6) / 16384;
          p += 8;
        }
        if (--budget.components < 0)
          fault(V ? 'glyph component expansion limit' : '', 'font-limit');
        const child = this.contours(id, axes, depth + 1, variation, budget).map((c) =>
          c.map((pt) => ({ x: pt.x * xx + pt.y * xy, y: pt.x * yx + pt.y * yy, on: pt.on })),
        );
        let dx = a,
          dy = c;
        if (!(flags & 2)) {
          const parent = contours.flat()[a],
            pt = child.flat()[c];
          if (!parent || !pt) fault(V ? 'invalid composite point attachment' : '');
          dx = parent.x - pt.x;
          dy = parent.y - pt.y;
        } else if (flags & 2048) {
          dx = a * xx + c * xy;
          dy = a * yx + c * yy;
        }
        if (flags & 4) {
          dx = Math.round(dx);
          dy = Math.round(dy);
        }
        const translated = child.map((c) => c.map((pt) => ({ ...pt, x: pt.x + dx, y: pt.y + dy })));
        components.push(translated);
        contours.push(...translated);
      } while (flags & 32);
      if (flags & 256) b.check(p + 2, b.u16(p));
      if (variation && this.tables.has('gvar')) {
        const varied = varyPoints(
          this,
          glyph,
          [
            ...components.map(() => ({ x: 0, y: 0, on: true })),
            { x: 0, y: 0, on: true },
            { x: this.#metrics[glyph]!, y: 0, on: true },
            { x: 0, y: this.ascent, on: true },
            { x: 0, y: -this.descent, on: true },
          ],
          [],
          axes,
        );
        components.forEach((component, i) =>
          component.forEach((contour) =>
            contour.forEach((pt) => {
              pt.x += varied[i]!.x;
              pt.y += varied[i]!.y;
            }),
          ),
        );
      }
      return contours;
    }
    if (count > 4096) fault(V ? 'glyph contour limit' : '', 'font-limit');
    const ends: number[] = [];
    for (let i = 0; i < count; i++) {
      const e = b.u16(p);
      p += 2;
      if (e <= (ends[i - 1] ?? -1)) fault(V ? 'invalid glyph contour end' : '');
      ends.push(e);
    }
    const instructions = b.u16(p);
    p += 2 + instructions;
    b.check(p, 0);
    const n = (ends.at(-1) ?? -1) + 1,
      flags: number[] = [];
    budget.points -= n;
    if (budget.points < 0) fault(V ? 'glyph point expansion limit' : '', 'font-limit');
    while (flags.length < n) {
      const f = b.u8(p++);
      let repeat = f & 8 ? b.u8(p++) : 0;
      if (flags.length + repeat + 1 > n) fault(V ? 'invalid glyph flag repeat' : '');
      do {
        flags.push(f);
      } while (repeat-- > 0);
    }
    const points: Point[] = flags.map((f) => ({ x: 0, y: 0, on: !!(f & 1) }));
    for (const axis of ['x', 'y'] as const) {
      let value = 0;
      const short = axis === 'x' ? 2 : 4,
        same = axis === 'x' ? 16 : 32;
      flags.forEach((f, i) => {
        if (f & short) {
          const d = b.u8(p++);
          value += f & same ? d : -d;
        } else if (!(f & same)) {
          value += b.i16(p);
          p += 2;
        }
        points[i]![axis] = value;
      });
    }
    let output = points;
    if (variation && this.tables.has('gvar'))
      output = varyPoints(
        this,
        glyph,
        [
          ...points,
          { x: 0, y: 0, on: true },
          { x: this.#metrics[glyph]!, y: 0, on: true },
          { x: 0, y: this.ascent, on: true },
          { x: 0, y: -this.descent, on: true },
        ],
        ends.map((e, i) => e - (ends[i - 1] ?? -1)),
        axes,
      ).slice(0, n);
    let previous = 0;
    return ends.map((e) => {
      const c = output.slice(previous, e + 1);
      previous = e + 1;
      return c;
    });
  }
  path(
    glyph: number,
    size = this.unitsPerEm,
    x = 0,
    baseline = 0,
    axes: Record<string, number> = {},
  ): string {
    const scale = size / this.unitsPerEm;
    if (!this.tables.has('glyf')) return cffOutline(this, glyph, scale, x, baseline);
    return contoursPath(this.contours(glyph, axes), scale, x, baseline);
  }
}
export function contoursPath(contours: Contour[], scale = 1, x = 0, baseline = 0): string {
  const point = (p: Point) => `${clean(x + p.x * scale)} ${clean(baseline - p.y * scale)}`;
  return contours
    .map((c) => {
      if (!c.length) return '';
      const first = c[0]!,
        last = c.at(-1)!;
      const start = first.on
        ? first
        : last.on
          ? last
          : { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2, on: true };
      const seq = first.on ? c.slice(1) : last.on ? c.slice(0, -1) : c;
      let out = 'M' + point(start);
      for (let i = 0; i < seq.length; i++) {
        const p = seq[i]!;
        if (p.on) out += 'L' + point(p);
        else {
          const next = seq[i + 1] ?? start;
          const end = next.on ? next : { x: (p.x + next.x) / 2, y: (p.y + next.y) / 2, on: true };
          out += 'Q' + point(p) + ' ' + point(end);
          if (next.on) i++;
        }
      }
      return out + 'Z';
    })
    .join('');
}
const clean = (n: number) => Number(n.toFixed(6));

function coverage(b: Bytes, p: number, g: number): number {
  const format = b.u16(p),
    n = b.u16(p + 2);
  if (format === 1) {
    for (let i = 0; i < n; i++) if (b.u16(p + 4 + i * 2) === g) return i;
  } else if (format === 2) {
    for (let i = 0; i < n; i++) {
      const q = p + 4 + i * 6,
        start = b.u16(q),
        end = b.u16(q + 2);
      if (g >= start && g <= end) return b.u16(q + 4) + g - start;
    }
  } else fault(V ? 'unsupported GPOS coverage' : '', 'font-unsupported');
  return -1;
}
function glyphClass(b: Bytes, p: number, g: number): number {
  const format = b.u16(p);
  if (format === 1) {
    const start = b.u16(p + 2),
      n = b.u16(p + 4);
    return g >= start && g < start + n ? b.u16(p + 6 + (g - start) * 2) : 0;
  }
  if (format === 2) {
    for (let i = 0; i < b.u16(p + 2); i++) {
      const q = p + 4 + i * 6;
      if (g >= b.u16(q) && g <= b.u16(q + 2)) return b.u16(q + 4);
    }
    return 0;
  }
  return fault(V ? 'unsupported GPOS class' : '', 'font-unsupported');
}
function pairAdjustment(font: Font, left: number, right: number): PairAdjustment | undefined {
  const b = font.table('GPOS'),
    gdef = font.tables.has('GDEF') ? font.table('GDEF') : undefined,
    classes = gdef?.u16(4),
    features = b.u16(6),
    list = b.u16(8),
    lookups = new Set<number>();
  // Only kern feature lookups. Other positioning features need script/language shaping.
  for (let i = 0; i < b.u16(features); i++) {
    const p = features + 2 + i * 6;
    if (b.tag(p) !== 'kern') continue;
    const f = features + b.u16(p + 4);
    for (let j = 0; j < b.u16(f + 2); j++) lookups.add(b.u16(f + 4 + j * 2));
  }
  let result: PairAdjustment | undefined;
  for (const index of lookups) {
    if (index >= b.u16(list)) fault(V ? 'invalid GPOS lookup index' : '');
    const lookup = list + b.u16(list + 2 + index * 2),
      type = b.u16(lookup),
      flag = b.u16(lookup + 2);
    // IgnoreBaseGlyphs/Ligatures/Marks: the lookup does not pair a glyph of an ignored GDEF class.
    if (classes && [left, right].some((g) => flag & 14 & (1 << glyphClass(gdef!, classes, g))))
      continue;
    for (let j = 0; j < b.u16(lookup + 4); j++) {
      let p = lookup + b.u16(lookup + 6 + j * 2),
        t = type;
      if (type === 9) {
        if (b.u16(p) !== 1) fault(V ? 'invalid GPOS extension' : '');
        t = b.u16(p + 2);
        p += b.u32(p + 4);
      }
      if (t !== 2) continue;
      let matched = false;
      const f = b.u16(p),
        ci = coverage(b, p + b.u16(p + 2), left);
      if (ci < 0) continue;
      const v1 = b.u16(p + 4),
        v2 = b.u16(p + 6);
      const len = (v: number) => {
        let count = 0;
        for (let i = 0; i < 8; i++) if (v & (1 << i)) count += 2;
        return count;
      };
      const size1 = len(v1),
        size2 = len(v2),
        value = (q: number): PairAdjustment => {
          const read = (format: number): GlyphAdjustment => {
            const out = zeroAdjustment();
            const keys = ['x', 'y', 'advanceX', 'advanceY'] as const;
            for (let bit = 0; bit < 8; bit++)
              if (format & (1 << bit)) {
                const v = b.i16(q);
                q += 2;
                if (bit < 4) out[keys[bit]!] = v;
                else if (v)
                  fault(
                    'GPOS device/variation adjustments are not implemented',
                    'font-unsupported',
                  );
              }
            return out;
          };
          return { first: read(v1), second: read(v2) };
        };
      const add = (pair: PairAdjustment) => {
        result ??= { first: zeroAdjustment(), second: zeroAdjustment() };
        for (const half of ['first', 'second'] as const)
          for (const key of ['x', 'y', 'advanceX', 'advanceY'] as const)
            result[half][key] += pair[half][key];
      };
      if (f === 1) {
        if (ci >= b.u16(p + 8)) fault(V ? 'invalid pair set' : '');
        const q = p + b.u16(p + 10 + ci * 2),
          n = b.u16(q);
        for (let k = 0; k < n; k++) {
          const r = q + 2 + k * (2 + size1 + size2);
          if (b.u16(r) === right) {
            add(value(r + 2));
            matched = true;
            break;
          }
        }
      } else if (f === 2) {
        const c1 = glyphClass(b, p + b.u16(p + 8), left),
          c2 = glyphClass(b, p + b.u16(p + 10), right),
          n1 = b.u16(p + 12),
          n2 = b.u16(p + 14);
        if (c1 >= n1 || c2 >= n2) fault(V ? 'invalid GPOS class index' : '');
        add(value(p + 16 + (c1 * n2 + c2) * (size1 + size2)));
        matched = true;
      } else fault(V ? 'unsupported GPOS pair format' : '', 'font-unsupported');
      // A lookup applies the first matching subtable, never all subtables.
      if (matched) break;
    }
  }
  return result;
}
