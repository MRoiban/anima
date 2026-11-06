import '@anima-format/core/all';
import { it, expect } from 'vitest';
import { load, Player, drawFrame, toSVG } from '@anima-format/core';
import { clockwisePath } from '../../core/winding.ts';
it('fills only strictly positive winding in y-down coordinates', () => {
  expect(clockwisePath('M0 0H10V10H0Z')).toBe('M0 0L10 0L10 10L0 10Z');
  expect(clockwisePath('M0 0V10H10V0Z')).toBe('');
  expect(clockwisePath('M0 0H10V10H0Z M2 2V8H8V2Z')).toBe(
    'M0 0L10 0L10 2L0 2ZM0 2L2 2L2 8L0 8ZM8 2L10 2L10 8L8 8ZM0 8L10 8L10 10L0 10Z',
  );
});
it('splits at self intersections rather than discarding whole contours by signed area', () => {
  expect(clockwisePath('M0 0L10 10H0L10 0Z')).toBe('M5 5L5 5L10 10L0 10Z');
});
it('sends ordinary positive-winding geometry to both backends', () => {
  const r = load({
    anima: '0.1',
    name: 'winding',
    grid: 20,
    requires: ['contour'],
    nodes: [
      {
        id: 'a',
        type: 'path',
        d: 'M2 2H18V18H2Z M5 5V15H15V5Z',
        fill: { color: '#4263eb', winding: 'clockwise' },
      },
    ],
  });
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  expect(drawFrame(p).nodes[0]!.paints[0]!.geometry!.d).toContain('M2 2L18 2L18 5L2 5Z');
  expect(toSVG(p)).toContain('d="M2 2L18 2L18 5L2 5Z');
});
