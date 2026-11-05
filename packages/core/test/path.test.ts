import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PathError, flatten, formatSegs, parsePath, selectPath } from '../src/index.ts';

const GLYPHS = new URL('../../../fixtures/glyphs/', import.meta.url);
const glyphs = readdirSync(GLYPHS).filter((f) => f.endsWith('.svg'));
const dOf = (f: string) => /\sd="([^"]+)"/.exec(readFileSync(new URL(f, GLYPHS), 'utf8'))![1]!;

describe('glyph fixtures', () => {
  it.each(glyphs)('%s: subpaths split and rejoin byte for byte', (f) => {
    const d = dOf(f);
    const sps = parsePath(d);
    expect(sps.length).toBe((d.match(/M/g) ?? []).length);
    expect(selectPath(d, sps)).toBe(d);
    expect(sps.map((_, i) => selectPath(d, sps, [i])).join('')).toBe(d);
    for (const sp of sps) expect(sp.absolute).toBe(true);
    // Normalised output round-trips to the same geometry.
    const again = parsePath(formatSegs(sps));
    expect(again.length).toBe(sps.length);
    again.forEach((sp, i) => sp.segs.forEach((v, k) => expect(v).toBeCloseTo(sps[i]!.segs[k]!, 3)));
  });

  it('bell has body, hollow and clapper', () => {
    const sps = parsePath(dOf('bell.svg'));
    expect(sps.length).toBe(3);
    expect(sps[2]!.segs.slice(0, 3)).toEqual([0, 10.173, 17.469]);
    expect(selectPath(dOf('bell.svg'), sps, [1, 0])).toBe(dOf('bell.svg').slice(0, sps[2]!.start));
  });
});

describe('path grammar', () => {
  const norm = (d: string) => formatSegs(parsePath(d));
  it('handles relative commands, implicit repeats, H/V, S/T, Q', () => {
    expect(norm('m1 1 2 0 0 2z')).toBe('M1 1L3 1L3 3Z');
    expect(norm('M0 0H5V5h-5v-5')).toBe('M0 0L5 0L5 5L0 5L0 0');
    expect(norm('M0 0C1 0 2 1 2 2S3 4 4 4')).toBe('M0 0C1 0 2 1 2 2C2 3 3 4 4 4');
    expect(norm('M0 0Q3 0 3 3T6 6')).toBe('M0 0C2 0 3 1 3 3C3 5 4 6 6 6');
    expect(norm('M0,0L.5.5-1e1,2')).toBe('M0 0L0.5 0.5L-10 2');
  });
  it('relative m after z starts from the subpath start', () => {
    const sps = parsePath('M10 10l5 0zm1 1l1 0z');
    expect(sps[1]!.segs.slice(0, 3)).toEqual([0, 11, 11]);
    expect(sps[1]!.absolute).toBe(false);
    expect(selectPath('M10 10l5 0zm1 1l1 0z', sps, [1])).toBe('M11 11L12 11Z');
  });
  it('converts arcs to cubics through the endpoints', () => {
    const sps = parsePath('M0 0A5 5 0 0 1 10 0');
    const g = sps[0]!.segs;
    expect(g.at(-2)).toBeCloseTo(10);
    expect(g.at(-1)).toBeCloseTo(0);
    // a half circle bulges to y = -5 (sweep 1 is clockwise in y-down, through the top)
    const ys = flatten(sps, 32)[0]!.pts.filter((_, i) => i % 2);
    expect(Math.min(...ys)).toBeCloseTo(-5, 2);
    expect(parsePath('M0 0a5 5 0 1010 0').length).toBe(1); // packed flags
  });
  it('reports errors with an offset', () => {
    for (const [bad, at] of [
      ['L1 1', 0],
      ['M0 0 L', 6],
      ['M0 0 X1', 5],
      ['M0 0Z 1', 6],
      ['', 0],
      ['M0 0A1 1 0 2 0 1 1', 11],
    ] as const) {
      try {
        parsePath(bad);
        expect.unreachable(bad);
      } catch (e) {
        expect(e).toBeInstanceOf(PathError);
        expect((e as PathError).at, bad).toBe(at);
      }
    }
  });
});
