import { expect, it } from 'vitest';
import { paintedBounds } from '../../core/bounds.ts';
import type { DrawNode } from '../../../../packages/core/src/draw.ts';
const I = [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number];
const node = (d: string, cap: string) =>
  ({
    geometry: { kind: 'path', d },
    paints: [{ kind: 'stroke', visible: true, width: 2, cap }],
    transform: I,
    visible: true,
    opacity: 1,
  }) as unknown as DrawNode;
it('R2-7: zero-length subpaths draw full round and square caps', () => {
  expect(paintedBounds(node('M5 5L5 5', 'round'), I)).toEqual([4, 4, 2, 2]);
  expect(paintedBounds(node('M5 5L5 5', 'square'), I)).toEqual([4, 4, 2, 2]);
  expect(paintedBounds(node('M5 5L5 5', 'butt'), I)).toEqual([5, 5, 0, 0]);
});
it('R2-7: a leading zero-length segment takes the cap direction from the next segment', () => {
  // Vertical line with square caps: caps extend vertically, width is the stroke.
  expect(paintedBounds(node('M5 5L5 5L5 9', 'square'), I)).toEqual([4, 4, 2, 6]);
});
