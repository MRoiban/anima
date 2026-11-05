import { describe, expect, it } from 'vitest';
import { inspectGlyph } from '../src/glyphs.ts';

describe('glyph subpath bounds', () => {
  it('uses absolute geometry for relative paths and identifies contained bboxes', () => {
    expect(inspectGlyph('M0 0h10v10H0z m2 2h3v4h-3z M20 20h1v1z')).toEqual([
      { index: 0, bbox: [0, 0, 10, 10], likelyHoleOf: [] },
      { index: 1, bbox: [2, 2, 5, 6], likelyHoleOf: [0] },
      { index: 2, bbox: [20, 20, 21, 21], likelyHoleOf: [] },
    ]);
  });
  it('bounds cubic extrema rather than their control points', () => {
    const [sp] = inspectGlyph('M0 0C0 8 8 8 8 0');
    expect(sp!.bbox).toEqual([0, 0, 8, 6]);
  });
  it('handles quadratic curves, arcs and degenerate movetos through core parsing', () => {
    expect(inspectGlyph('M0 0Q4 8 8 0')[0]!.bbox).toEqual([0, 0, 8, 4]);
    const arc = inspectGlyph('M0 0A5 5 0 0 1 10 0')[0]!.bbox;
    expect(arc[0]).toBeCloseTo(0);
    expect(arc[1]).toBeCloseTo(-5);
    expect(arc.slice(2)).toEqual([10, 0]);
    expect(inspectGlyph('M3 4')[0]!.bbox).toEqual([3, 4, 3, 4]);
  });
});
