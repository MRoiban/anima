import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync, brotliCompressSync } from 'node:zlib';
import ts from 'typescript';
import { testFont } from '../../../tools/test-font.ts';
import { Bytes, checksum, sfnt } from '../src/font/binary.ts';
import { Font, readFont } from '../src/font/reader.ts';
import { normalizeFont } from '../src/font/container.ts';
import { ToolMeasurer, shapingDiagnostic, type FontSpec } from '../src/font/measure.ts';
import { subsetFont } from '../src/font/subset.ts';
import { outlineSVG } from '../src/font/svg.ts';
import { documentFonts, buildFont, documentCharacters } from '../src/font/document.ts';
import { googleFonts } from '../src/font/import.ts';
import { browserTextPNG } from '../src/font/browser.ts';
import { importSVG } from '../src/import-svg.ts';
import { ImageEncoder } from '../src/encode.ts';
import { buildAssets } from '../src/build-assets.ts';
import { run } from '../src/cli.ts';

const bytes = testFont(),
  font = new Font(bytes);
const spec: FontSpec = {
  family: 'Anima Test',
  size: 10,
  weight: 400,
  style: 'normal',
  tracking: 0,
};
function measurer() {
  const m = new ToolMeasurer();
  m.register('Anima Test', font);
  return m;
}
function woff(input: Buffer): Buffer {
  const f = new Font(input),
    tables = [...f.tables],
    chunks: Buffer[] = [],
    header = Buffer.alloc(44 + tables.length * 20);
  let off = header.length;
  header.write('wOFF');
  header.writeUInt32BE(f.flavor, 4);
  header.writeUInt16BE(tables.length, 12);
  header.writeUInt32BE(input.length, 16);
  tables.forEach(([tag, data], i) => {
    const zip = deflateSync(data),
      raw = zip.length < data.length ? zip : data,
      p = 44 + i * 20;
    header.write(tag, p);
    header.writeUInt32BE(off, p + 4);
    header.writeUInt32BE(raw.length, p + 8);
    header.writeUInt32BE(data.length, p + 12);
    header.writeUInt32BE(checksum(data), p + 16);
    chunks.push(raw);
    off += raw.length;
    const pad = (4 - (off % 4)) % 4;
    chunks.push(Buffer.alloc(pad));
    off += pad;
  });
  header.writeUInt32BE(off, 8);
  return Buffer.concat([header, ...chunks]);
}
const base128 = (n: number) => {
  const a = [n & 127];
  while ((n >>>= 7)) a.unshift((n & 127) | 128);
  return Buffer.from(a);
};
function woff2(input: Buffer, transformed = false, metrics = false): Buffer {
  const f = new Font(input),
    tables = new Map(f.tables),
    records: Buffer[] = [],
    chunks: Buffer[] = [];
  let transform: Buffer | undefined;
  if (transformed) {
    // Our generated font has four on-curve points per glyph. Encode full 16-bit triplets.
    const counts = Buffer.alloc(font.glyphCount * 2),
      npoints: number[] = [],
      flags: number[] = [],
      coords: Buffer[] = [],
      boxes: Buffer[] = [];
    for (let id = 0; id < font.glyphCount; id++) {
      const c = font.contours(id);
      counts.writeInt16BE(c.length, id * 2);
      if (!c.length) continue;
      npoints.push(4);
      let x = 0,
        y = 0;
      for (const pt of c.flat()) {
        const dx = pt.x - x,
          dy = pt.y - y;
        x = pt.x;
        y = pt.y;
        flags.push(124 | (dx >= 0 ? 1 : 0) | (dy >= 0 ? 2 : 0));
        const raw = Buffer.alloc(4);
        raw.writeUInt16BE(Math.abs(dx));
        raw.writeUInt16BE(Math.abs(dy), 2);
        coords.push(raw);
      }
      coords.push(Buffer.from([0]));
    }
    const streams = [
      counts,
      Buffer.from(npoints),
      Buffer.from(flags),
      Buffer.concat(coords),
      Buffer.alloc(0),
      Buffer.alloc(4 * Math.floor((font.glyphCount + 31) / 32)),
      Buffer.concat(boxes),
    ];
    const h = Buffer.alloc(36);
    h.writeUInt16BE(font.glyphCount, 4);
    h.writeUInt16BE(1, 6);
    streams.forEach((s, i) => h.writeUInt32BE(s.length, 8 + i * 4));
    transform = Buffer.concat([h, ...streams]);
  }
  for (const [tag, data] of tables) {
    const changed =
        (transformed && (tag === 'glyf' || tag === 'loca')) || (metrics && tag === 'hmtx'),
      flags =
        63 +
        (metrics && tag === 'hmtx' ? 64 : (tag === 'glyf' || tag === 'loca') && !changed ? 192 : 0);
    let raw = changed ? (tag === 'glyf' ? transform! : Buffer.alloc(0)) : data;
    if (metrics && tag === 'hmtx') {
      raw = Buffer.alloc(1 + font.glyphCount * 2);
      raw[0] = 3;
      for (let i = 0; i < font.glyphCount; i++) raw.writeUInt16BE(font.advance(i), 1 + i * 2);
    }
    records.push(Buffer.from([flags]), Buffer.from(tag), base128(data.length));
    if (changed) records.push(base128(raw.length));
    chunks.push(raw);
  }
  const compressed = brotliCompressSync(Buffer.concat(chunks)),
    directory = Buffer.concat(records),
    head = Buffer.alloc(48);
  head.write('wOF2');
  head.writeUInt32BE(f.flavor, 4);
  head.writeUInt32BE(48 + directory.length + compressed.length, 8);
  head.writeUInt16BE(tables.size, 12);
  head.writeUInt32BE(input.length, 16);
  head.writeUInt32BE(compressed.length, 20);
  return Buffer.concat([head, directory, compressed]);
}

describe('original OpenType reader and generated fixture', () => {
  it('is deterministic and has a valid whole-font checksum', () => {
    expect(
      bytes.equals(
        readFileSync(new URL('../../../fixtures/fonts/anima-test.ttf', import.meta.url)),
      ),
    ).toBe(true);
    expect(checksum(bytes)).toBe(0xb1b0afba);
    expect(font.family).toBe('Anima Test');
    expect(font.unitsPerEm).toBe(1000);
    expect(font.hasGlyph('א')).toBe(true);
    expect(font.hasGlyph('ب')).toBe(true);
    expect(font.hasGlyph('😀')).toBe(true);
    expect(font.hasGlyph('界')).toBe(false);
  });
  it('reads metrics, kern, named instances and variable simple outlines', () => {
    expect([font.ascent, font.descent, font.capHeight, font.xHeight, font.lineGap]).toEqual([
      800, 200, 700, 500, 100,
    ]);
    expect(font.kerning(font.glyph(65), font.glyph(86))).toBe(-100);
    expect(font.kerning(font.glyph(65), font.glyph(86), { kern: 0 })).toBe(0);
    expect(font.axes).toEqual([{ tag: 'wght', min: 100, default: 400, max: 900, name: 'Weight' }]);
    expect(font.instances).toEqual([{ name: 'Bold', axes: { wght: 700 } }]);
    const id = font.glyph(65),
      normal = font.contours(id),
      heavy = font.contours(id, { wght: 900 }),
      half = font.contours(id, { wght: 650 });
    expect(heavy[0]![1]!.x - normal[0]![1]!.x).toBe(100);
    expect(half[0]![1]!.x - normal[0]![1]!.x).toBe(50);
    expect(font.advance(id, { wght: 900 })).toBe(600);
    expect(font.path(id, 10)).toMatch(/^M0.5 0L/);
  });
  it('supports cmap4, including the idRangeOffset form', () => {
    const tables = new Map(font.tables),
      cmap = Buffer.alloc(44);
    cmap.writeUInt16BE(1, 2);
    cmap.writeUInt16BE(3, 4);
    cmap.writeUInt16BE(1, 6);
    cmap.writeUInt32BE(12, 8);
    const t = cmap.subarray(12);
    t.writeUInt16BE(4);
    t.writeUInt16BE(32, 2);
    t.writeUInt16BE(4, 6);
    t.writeUInt16BE(65, 14);
    t.writeUInt16BE(65535, 16);
    t.writeUInt16BE(65, 20);
    t.writeUInt16BE(65535, 22);
    t.writeInt16BE(font.glyph(65) - 65, 24);
    t.writeInt16BE(1, 26);
    tables.set('cmap', cmap);
    expect(new Font(sfnt(tables)).glyph(65)).toBe(font.glyph(65));
    const indirect = Buffer.concat([cmap, Buffer.alloc(2)]);
    indirect.writeUInt16BE(34, 14);
    indirect.writeInt16BE(0, 36);
    indirect.writeUInt16BE(4, 40);
    indirect.writeUInt16BE(font.glyph(65), 44);
    tables.set('cmap', indirect);
    expect(new Font(sfnt(tables)).glyph(65)).toBe(font.glyph(65));
  });
  it.each(['woff', 'woff2', 'transformed', 'hmtx'])(
    'decodes %s with identical metrics and outlines',
    (kind) => {
      const encoded =
          kind === 'woff' ? woff(bytes) : woff2(bytes, kind === 'transformed', kind === 'hmtx'),
        decoded = new Font(encoded);
      expect(decoded.coverage).toEqual(font.coverage);
      for (const cp of [65, 86, 0x627, 0x1f600]) {
        const g = font.glyph(cp);
        expect(decoded.path(g)).toBe(font.path(g));
        expect(decoded.advance(g)).toBe(font.advance(g));
      }
      expect(new Font(normalizeFont(encoded)).family).toBe(font.family);
    },
  );

  it('reads CFF Type2 cubic outlines from an original synthetic OTF', () => {
    const index = (items: Buffer[]) => {
      const head = Buffer.alloc(3 + (items.length + 1) * 2);
      head.writeUInt16BE(items.length);
      head[2] = 2;
      let offset = 1;
      items.forEach((item, i) => {
        head.writeUInt16BE(offset, 3 + i * 2);
        offset += item.length;
      });
      head.writeUInt16BE(offset, 3 + items.length * 2);
      return Buffer.concat([head, ...items]);
    };
    const names = index([Buffer.from('Original')]);
    const topOffset = 4 + names.length + 7 + 6 + 2 + 2;
    const top = Buffer.alloc(6);
    top[0] = 29;
    top.writeUInt32BE(topOffset, 1);
    top[5] = 17;
    const glyph = Buffer.from([139, 139, 21, 239, 139, 139, 239, 39, 139, 8, 14]);
    const cff = Buffer.concat([
      Buffer.from([1, 0, 4, 4]),
      names,
      index([top]),
      Buffer.alloc(2),
      Buffer.alloc(2),
      index(Array.from({ length: font.glyphCount }, () => glyph)),
    ]);
    const tables = new Map(font.tables);
    tables.delete('glyf');
    tables.delete('loca');
    tables.delete('gvar');
    tables.delete('fvar');
    tables.set('CFF ', cff);
    const otf = new Font(sfnt(tables, 0x4f54544f));
    expect(otf.path(otf.glyph(65), 10)).toBe('M0 0C1 0 1 -1 0 -1Z');
    const subset = subsetFont(sfnt(tables, 0x4f54544f), 'A'),
      f = new Font(subset);
    expect(subset.length).toBeLessThan(sfnt(tables, 0x4f54544f).length);
    expect(f.path(f.glyph(65), 10)).toBe(otf.path(otf.glyph(65), 10));
    expect(f.hasGlyph('B')).toBe(false);
    expect(f.path(font.glyph(66))).toBe('');
  });

  it('relocates CFF private dictionaries and local subroutines when subsetting', () => {
    const index = (items: Buffer[]) => {
      const h = Buffer.alloc(3 + (items.length + 1) * 4);
      h.writeUInt16BE(items.length);
      h[2] = 4;
      let p = 1;
      items.forEach((item, i) => {
        h.writeUInt32BE(p, 3 + i * 4);
        p += item.length;
      });
      h.writeUInt32BE(p, 3 + items.length * 4);
      return Buffer.concat([h, ...items]);
    };
    const names = index([Buffer.from('Original')]),
      top = Buffer.alloc(17),
      glyph = Buffer.from([139, 139, 21, 32, 10, 14]),
      chars = index(Array.from({ length: font.glyphCount }, () => glyph));
    const charStart = 4 + names.length + index([top]).length + 4,
      privateStart = charStart + chars.length;
    top[0] = 29;
    top.writeInt32BE(charStart, 1);
    top[5] = 17;
    top[6] = 29;
    top.writeInt32BE(6, 7);
    top[11] = 29;
    top.writeInt32BE(privateStart, 12);
    top[16] = 18;
    const cff = Buffer.concat([
      Buffer.from([1, 0, 4, 4]),
      names,
      index([top]),
      Buffer.alloc(4),
      chars,
      Buffer.from([29, 0, 0, 0, 6, 19]),
      index([Buffer.from([239, 139, 139, 239, 39, 139, 8, 11])]),
    ]);
    const tables = new Map(font.tables);
    for (const key of ['glyf', 'loca', 'gvar', 'fvar']) tables.delete(key);
    const maxp = Buffer.alloc(6);
    maxp.writeUInt32BE(0x5000);
    maxp.writeUInt16BE(font.glyphCount, 4);
    tables.set('maxp', maxp);
    tables.set('CFF ', cff);
    const input = sfnt(tables, 0x4f54544f),
      before = new Font(input),
      subset = subsetFont(input, 'A'),
      after = new Font(subset);
    expect(before.path(before.glyph(65), 10)).toBe('M0 0C1 0 1 -1 0 -1Z');
    expect(after.path(after.glyph(65), 10)).toBe(before.path(before.glyph(65), 10));
    expect(subset.length).toBeLessThan(input.length);
    expect(after.path(font.glyph(66))).toBe('');
    expect(checksum(subset)).toBe(0xb1b0afba);
  });

  it.each([1, 2])('reads GPOS pair adjustment format %s and honors kern=0', (format) => {
    const left = font.glyph(65),
      right = font.glyph(86),
      pair = Buffer.alloc(format === 1 ? 24 : 44);
    pair.writeUInt16BE(format);
    pair.writeUInt16BE(format === 1 ? 18 : 36, 2);
    pair.writeUInt16BE(4, 4);
    if (format === 1) {
      pair.writeUInt16BE(1, 8);
      pair.writeUInt16BE(12, 10);
      pair.writeUInt16BE(1, 12);
      pair.writeUInt16BE(right, 14);
      pair.writeInt16BE(-75, 16);
      pair.writeUInt16BE(1, 18);
      pair.writeUInt16BE(1, 20);
      pair.writeUInt16BE(left, 22);
    } else {
      pair.writeUInt16BE(24, 8);
      pair.writeUInt16BE(30, 10);
      pair.writeUInt16BE(1, 12);
      pair.writeUInt16BE(2, 14);
      pair.writeInt16BE(-75, 18);
      pair.writeUInt16BE(1, 24);
      pair.writeUInt16BE(left, 26);
      pair.writeUInt16BE(0, 28);
      pair.writeUInt16BE(1, 30);
      pair.writeUInt16BE(right, 32);
      pair.writeUInt16BE(1, 34);
      pair.writeUInt16BE(1, 36);
      pair.writeUInt16BE(1, 38);
      pair.writeUInt16BE(left, 40);
      pair.writeUInt16BE(1, 42);
    }
    // Class definition 2 needs one value for the right glyph. Place it before coverage.
    if (format === 2) {
      pair.writeUInt16BE(2, 30);
      pair.writeUInt16BE(1, 32);
      pair.writeUInt16BE(right, 34);
      pair.writeUInt16BE(right, 36);
      pair.writeUInt16BE(1, 38);
      pair.writeUInt16BE(40, 2);
    }
    let actual = pair;
    if (format === 2) {
      actual = Buffer.concat([
        pair.subarray(0, 40),
        Buffer.from([0, 1, 0, 1, left >> 8, left & 255]),
      ]);
    }
    const header = Buffer.alloc(10);
    header.writeUInt32BE(0x10000);
    header.writeUInt16BE(10, 4);
    header.writeUInt16BE(12, 6);
    header.writeUInt16BE(26, 8);
    const feature = Buffer.alloc(14);
    feature.writeUInt16BE(1);
    feature.write('kern', 2);
    feature.writeUInt16BE(8, 6);
    feature.writeUInt16BE(1, 10);
    feature.writeUInt16BE(0, 12);
    const lookups = Buffer.from([0, 1, 0, 4, 0, 2, 0, 0, 0, 1, 0, 8]);
    const tables = new Map(font.tables);
    tables.set('GPOS', Buffer.concat([header, Buffer.alloc(2), feature, lookups, actual]));
    const f = new Font(sfnt(tables));
    expect(f.kerning(left, right)).toBe(-75);
    expect(f.kerning(left, right, { kern: 0 })).toBe(0);
    if (format === 2) {
      actual.writeUInt16BE(5, 4);
      actual.writeInt16BE(10, 20);
      actual.writeInt16BE(-75, 22);
      tables.set('GPOS', Buffer.concat([header, Buffer.alloc(2), feature, lookups, actual]));
      const placed = new Font(sfnt(tables)),
        m = new ToolMeasurer();
      m.register('Anima Test', placed);
      expect(placed.positionPair(left, right).first).toEqual({
        x: 10,
        y: 0,
        advanceX: -75,
        advanceY: 0,
      });
      expect(m.outline(spec, 'AV')).toBe(placed.path(left, 10, 0.1) + placed.path(right, 10, 5.25));
    }
  });

  it('preserves composite dependencies while subsetting and applies component gvar deltas', () => {
    const a = font.glyph(65),
      b = font.glyph(66),
      tables = new Map(font.tables),
      old = font.table('glyf'),
      loca = font.table('loca'),
      chunks: Buffer[] = [],
      newLoca = Buffer.alloc((font.glyphCount + 1) * 4);
    let offset = 0;
    for (let id = 0; id < font.glyphCount; id++) {
      newLoca.writeUInt32BE(offset, id * 4);
      let raw = old.slice(loca.u32(id * 4), loca.u32(id * 4 + 4) - loca.u32(id * 4));
      if (id === b) {
        raw = Buffer.alloc(18);
        raw.writeInt16BE(-1);
        raw.writeInt16BE(50, 2);
        raw.writeInt16BE(700, 8);
        raw.writeUInt16BE(3, 10);
        raw.writeUInt16BE(a, 12);
        raw.writeInt16BE(20, 14);
      }
      chunks.push(raw);
      offset += raw.length;
    }
    newLoca.writeUInt32BE(offset, font.glyphCount * 4);
    tables.set('glyf', Buffer.concat(chunks));
    tables.set('loca', newLoca);
    const offsets = Buffer.alloc((font.glyphCount + 1) * 4),
      header = Buffer.alloc(20),
      tuple = Buffer.from([0, 1, 0, 10, 0, 7, 128, 0, 64, 0, 4, 25, 0, 0, 0, 0, 132]);
    for (let i = b + 1; i <= font.glyphCount; i++) offsets.writeUInt32BE(tuple.length, i * 4);
    header.writeUInt32BE(0x10000);
    header.writeUInt16BE(1, 4);
    header.writeUInt32BE(20 + offsets.length, 8);
    header.writeUInt16BE(font.glyphCount, 12);
    header.writeUInt16BE(1, 14);
    header.writeUInt32BE(20 + offsets.length, 16);
    tables.set('gvar', Buffer.concat([header, offsets, tuple]));
    const input = sfnt(tables),
      f = new Font(input);
    expect(f.contours(b)[0]![0]!.x).toBe(font.contours(a)[0]![0]!.x + 20);
    expect(f.contours(b, { wght: 900 })[0]![0]!.x).toBe(font.contours(a)[0]![0]!.x + 45);
    expect(f.advance(b, { wght: 900 })).toBe(600);
    const subset = new Font(subsetFont(input, 'B'));
    expect(subset.path(b)).toBe(f.path(b));
    expect(subset.hasGlyph('A')).toBe(false);
    expect(subset.path(a)).not.toBe('');
  });

  it('returns structured errors for truncations, malformed offsets and deterministic byte mutations', () => {
    for (let n = 0; n < bytes.length; n += 43) {
      const r = readFont(bytes.subarray(0, n), '/assets/f/source');
      expect(r.font).toBeUndefined();
      expect(r.diagnostics[0]).toMatchObject({
        code: expect.stringMatching(/^font-/),
        pointer: '/assets/f/source',
        severity: 'error',
        message: expect.any(String),
        hint: expect.any(String),
      });
    }
    let seed = 7;
    for (let i = 0; i < 150; i++) {
      const changed = Buffer.from(bytes);
      for (let j = 0; j < 3; j++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        changed[seed % changed.length] ^= seed & 255;
      }
      expect(() => readFont(changed)).not.toThrow();
    }
    expect(() => new Bytes(Buffer.alloc(0)).u32(0)).toThrow();
    const bounded = new Bytes(Buffer.alloc(1));
    expect(() => {
      for (let i = 0; i < 2_000_001; i++) bounded.u8(0);
    }).toThrowError(expect.objectContaining({ code: 'font-limit' }));
    expect(() =>
      font.contours(font.glyph(65), {}, 0, true, { points: 1, components: 1 }),
    ).toThrowError(expect.objectContaining({ code: 'font-limit' }));
    const tables = new Map(font.tables),
      kern = Buffer.from(tables.get('kern')!);
    kern.writeUInt16BE(65535, 10);
    tables.set('kern', kern);
    expect(() => new Font(sfnt(tables)).kerning(font.glyph(65), font.glyph(86))).toThrow(
      /kern pair data/,
    );
  });
});

describe('tool text measurement / outlines / subsetting', () => {
  it('measures cumulative grapheme advances, kerning and tracking in grid units', () => {
    const m = measurer();
    expect([...m.measure(spec, 'AV').advances]).toEqual([6, 11]);
    expect([...m.measure({ ...spec, tracking: 0.5 }, 'AV').advances]).toEqual([6, 11.5]);
    expect(m.measure(spec, 'e\u0301').advances.length).toBe(1);
    expect([...m.measure(spec, '').advances]).toEqual([]);
    expect(() => m.measure({ ...spec, family: 'missing' }, 'a')).toThrow(/no local font/);
  });
  it('warns only for runs requiring unsupported shaping', () => {
    const emitted: string[] = [];
    const m = measurer();
    m.onDiagnostic = (d) => emitted.push(d.code);
    m.measure(spec, 'ب');
    expect(emitted).toEqual(['text-shaping-approximate']);
    expect(shapingDiagnostic('AV')).toEqual([]);
    expect(shapingDiagnostic('ب', '/nodes/0/runs/0/text')[0]).toMatchObject({
      code: 'text-shaping-approximate',
      severity: 'warning',
      pointer: '/nodes/0/runs/0/text',
      hint: expect.stringContaining('--browser-text'),
    });
  });
  it('converts SVG text to paths with positioning, style, paint and transforms', () => {
    const svg = outlineSVG(
      '<svg><text x="2" y="9" font-family="Anima Test" font-size="10" fill="#123456" transform="translate(1 2)">A<tspan dx="1">V</tspan></text></svg>',
      measurer(),
    );
    expect(svg).not.toContain('<text');
    expect(svg).toContain('<path d="M2.5 9');
    expect(svg).toContain('fill="#123456"');
    expect(svg).toContain('transform="translate(1 2)"');
    expect(importSVG(svg, 'outlined').diagnostics).toEqual([]);
    expect(() =>
      outlineSVG('<svg><text font-family="Anima Test" x="1 2">AV</text></svg>', measurer()),
    ).toThrow(/scalar/);
  });
  it('subsets payloads and cmap while retaining glyph IDs, kern, variations and deterministic bytes', () => {
    const subset = subsetFont(bytes, 'AV'),
      f = new Font(subset);
    expect(subset.length).toBeLessThan(bytes.length);
    expect(f.glyph(65)).toBe(font.glyph(65));
    expect(f.hasGlyph('B')).toBe(false);
    expect(f.path(font.glyph(66))).toBe('');
    expect(f.path(f.glyph(65), 10, 0, 0, { wght: 900 })).toBe(
      font.path(font.glyph(65), 10, 0, 0, { wght: 900 }),
    );
    expect(f.kerning(f.glyph(65), f.glyph(86))).toBe(-100);
    expect(subset.equals(subsetFont(bytes, 'VAAV'))).toBe(true);
    expect(checksum(subset)).toBe(0xb1b0afba);
  });
  it('tests all/custom policies and emits coded errors for missing glyph options and limits', () => {
    const source = 'data:font/ttf;base64,' + bytes.toString('base64'),
      all = { type: 'font', source, glyphs: 'all' as const };
    buildFont(all, {}, '/tmp/a.ani');
    expect(all.source).toBe(source);
    const custom = { type: 'font', source, glyphs: 'custom' as const, chars: 'é' };
    buildFont(custom, {}, '/tmp/a.ani');
    const f = new Font(Buffer.from(custom.source.split(',')[1]!, 'base64'));
    expect(f.hasGlyph('é')).toBe(true);
    expect(f.hasGlyph('A')).toBe(false);
    expect(() =>
      buildFont({ type: 'font', source, glyphs: 'custom' }, {}, '/tmp/a.ani'),
    ).toThrowError(expect.objectContaining({ code: 'font-glyphs' }));
    expect(readFont(Buffer.alloc(32 * 1024 * 1024 + 1)).diagnostics[0]?.code).toBe('font-limit');
    expect(() => measurer().measure({ ...spec, family: 'absent' }, 'A')).toThrowError(
      expect.objectContaining({ code: 'font-missing' }),
    );
  });
  it('registers document fonts, aliases, overrides and builds used/custom/all coverage', () => {
    const asset = {
      type: 'font',
      source: 'data:font/ttf;base64,' + bytes.toString('base64'),
      glyphs: 'used' as const,
    };
    const doc = {
      assets: { face: asset },
      nodes: [{ runs: [{ text: 'AV' }] }],
      data: { default: 'é' },
    };
    expect(
      documentFonts(doc, '/tmp/a.ani').measurer.measure({ ...spec, family: 'face' }, 'AV')
        .advances[1],
    ).toBe(11);
    expect(documentCharacters(doc)).toBe('AVé');
    buildFont(asset, doc, '/tmp/a.ani');
    const subset = new Font(Buffer.from(asset.source.split(',')[1]!, 'base64'));
    expect(subset.hasGlyph('é')).toBe(true);
    expect(subset.hasGlyph('B')).toBe(false);
    expect(
      documentFonts(
        { assets: { f: { type: 'font', source: 'https://invalid/font' } } },
        '/tmp/a.ani',
      ).diagnostics[0],
    ).toMatchObject({ code: 'font-source', pointer: '/assets/f/source' });
    expect(documentFonts({}, '/tmp/a.ani', ['invalid']).diagnostics[0]?.code).toBe('font-option');
  });

  it('builds nested used-font assets with inherited root defaults in the coverage set', async () => {
    const asset = {
      type: 'font' as const,
      source: 'data:font/ttf;base64,' + bytes.toString('base64'),
      glyphs: 'used' as const,
    };
    const doc = {
      data: { default: 'é' },
      components: { child: { assets: { face: asset }, nodes: [{ runs: [{ text: 'AV' }] }] } },
    };
    expect(await buildAssets(doc, '/tmp/doc.ani', false)).toEqual([]);
    const f = new Font(Buffer.from(asset.source.split(',')[1]!, 'base64'));
    expect(f.hasGlyph('é')).toBe(true);
    expect(f.hasGlyph('A')).toBe(true);
    expect(f.hasGlyph('B')).toBe(false);
  });

  it.skipIf(!existsSync(new URL('../../../modules/text/core/measure.ts', import.meta.url)))(
    'keeps the DESIGN §4 type declarations synchronized with the text module when installed',
    () => {
      const runtime = new URL('../../../modules/text/core/measure.ts', import.meta.url);
      const declarations = (text: string) => {
        const src = ts.createSourceFile('contract.ts', text, ts.ScriptTarget.Latest, true);
        return Object.fromEntries(
          src.statements
            .filter(
              (s) =>
                (ts.isTypeAliasDeclaration(s) || ts.isInterfaceDeclaration(s)) &&
                ['FontSpec', 'Measured', 'TextMeasurer'].includes(s.name.text),
            )
            .map((s) => {
              const d = s as ts.TypeAliasDeclaration | ts.InterfaceDeclaration;
              return [
                d.name.text,
                ts
                  .createPrinter({ removeComments: true })
                  .printNode(ts.EmitHint.Unspecified, d, src)
                  .replace(/\bexport\s+/g, '')
                  .replace(/\s/g, ''),
              ];
            }),
        );
      };
      expect(declarations(readFileSync(runtime, 'utf8'))).toEqual(
        declarations(readFileSync(new URL('../src/font/measure.ts', import.meta.url), 'utf8')),
      );
    },
  );
});

describe('font CLI and explicit Google import', () => {
  it('fetches Google CSS and localizes/subsets font bytes with a mocked network', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'anima-font-'));
    try {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response('@font-face{src:url(https://fonts.gstatic.com/s/test.ttf)}'),
        )
        .mockResolvedValueOnce(new Response(new Uint8Array(bytes)));
      const result = await googleFonts(
        'Example:wght@400;600',
        join(dir, 'font.ttf'),
        'AV',
        fetcher,
      );
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(new URL(String(fetcher.mock.calls[0]![0])).searchParams.get('family')).toBe(
        'Example:wght@400;600',
      );
      expect(result[0]?.source).toBe(join(dir, 'font.ttf'));
      expect(new Font(readFileSync(result[0]!.source)).hasGlyph('B')).toBe(false);
      await expect(
        googleFonts(
          'Example',
          join(dir, 'bad.ttf'),
          undefined,
          vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 })),
        ),
      ).rejects.toMatchObject({ code: 'font-download' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('imports local font formats and validates broken --font bytes without uncaught errors', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'anima-font-cli-'));
    try {
      const input = join(dir, 'source.woff'),
        output = join(dir, 'local.ttf'),
        doc = join(dir, 'doc.ani'),
        bad = join(dir, 'bad.ttf');
      writeFileSync(input, woff(bytes));
      writeFileSync(bad, Buffer.from('broken'));
      writeFileSync(
        doc,
        JSON.stringify({
          anima: '0.1',
          name: 'test',
          grid: 24,
          nodes: [
            { id: 'box', type: 'rect', x0: 0, y0: 0, w: 1, h: 1, fill: { color: '#000000' } },
          ],
        }),
      );
      const lines: string[] = [];
      const io = { out: (s: string) => lines.push(s), err: (s: string) => lines.push(s) };
      expect(
        await run(['import-font', input, '-o', output, '--chars', 'AV', '--format=json'], io),
      ).toBe(0);
      expect(new Font(readFileSync(output)).hasGlyph('B')).toBe(false);
      lines.length = 0;
      expect(await run(['validate', doc, '--font', 'Test=' + bad, '--format=json'], io)).toBe(1);
      expect(JSON.parse(lines[0]!).diagnostics[0]).toMatchObject({
        code: 'font-format',
        pointer: '/font',
      });
      expect(await run(['flatten', doc, '--node', 'missing', '--format=json'], io)).toBe(1);
      expect(JSON.parse(lines.at(-1)!).diagnostics[0].code).toBe('font-flatten');
      writeFileSync(
        doc,
        JSON.stringify({
          anima: '0.1',
          name: 'test',
          grid: 24,
          requires: ['fonts'],
          assets: { bad: null },
          components: { bad: null },
          nodes: [],
        }),
      );
      lines.length = 0;
      expect(await run(['validate', doc, '--format=json'], io)).toBe(1);
      expect(JSON.parse(lines[0]!).diagnostics.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('browser geometricPrecision matches tool kerning; retains the default hinting finding', async () => {
    const session = new ImageEncoder();
    try {
      const browser = await session.browser(),
        page = await browser.newPage();
      try {
        const measured = await page.evaluate(
          async (uri) => {
            const face = new FontFace('Test', `url(${uri})`);
            document.fonts.add(await face.load());
            const canvas = document.createElement('canvas'),
              ctx = canvas.getContext('2d')!;
            ctx.font = '20px Test';
            const hinted = ctx.measureText('AV').width;
            ctx.textRendering = 'geometricPrecision';
            return {
              a: ctx.measureText('A').width,
              av: ctx.measureText('AV').width,
              xHeight: ctx.measureText('x').actualBoundingBoxAscent,
              hinted,
            };
          },
          'data:font/ttf;base64,' + bytes.toString('base64'),
        );
        const tool = measurer().measure({ ...spec, size: 20 }, 'AV');
        expect(Math.abs(measured.a - tool.advances[0]!)).toBeLessThan(0.1);
        expect(Math.abs(measured.av - tool.advances[1]!)).toBeLessThan(0.1);
        expect(Math.abs(measured.xHeight - tool.xHeight)).toBeLessThan(0.1);
        // Known Chromium auto-hinting difference, never treated as equivalent layout.
        expect(measured.hinted - tool.advances[1]!).toBe(1);
      } finally {
        await page.close();
      }
    } finally {
      await session.close();
    }
  }, 30000);

  it('reports a coded diagnostic when Chromium rejects malformed font bytes', async () => {
    const broken = new Font(bytes);
    broken.tables.get('head')!.writeUInt32BE(0, 12);
    const m = new ToolMeasurer();
    m.register('Broken', broken);
    await expect(
      browserTextPNG(
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><text font-family="Broken">A</text></svg>',
        m,
      ),
    ).rejects.toMatchObject({ code: 'font-invalid', pointer: '', hint: expect.any(String) });
  }, 30000);

  it('browser-text uses the cached Chromium and loads the original generated font', async () => {
    const png = await browserTextPNG(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="30"><text font-family="Anima Test" font-size="20" x="1" y="20">AV</text></svg>',
      measurer(),
    );
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  }, 30000);
});
