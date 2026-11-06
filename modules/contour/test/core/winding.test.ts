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
it.each([
  ['M2 2V18H18V2Z', [10, 10], false],
  ['M2 2H18V18H2Z', [10, 10], true],
  ['M2 2H18V18H2Z M5 5V15H15V5Z', [10, 10], false],
  ['M2 2H18V18H2Z M5 5V15H15V5Z', [3, 10], true],
  ['M0 0L10 10H0L10 0Z', [5, 8], true],
  ['M0 0L10 10H0L10 0Z', [5, 2], false],
  ['M2 2H18V18H2', [10, 10], true],
] as const)(
  'hits exactly the positive local winding, including open paths: %s',
  (d, at, expected) => {
    const r = load({
      anima: '0.1',
      name: 'hit',
      grid: 20,
      requires: ['contour'],
      nodes: [{ id: 'a', type: 'path', d, fill: { color: '#000', winding: 'clockwise' } }],
      inputs: { clicked: { type: 'bool' } },
      listeners: [{ on: 'click', target: 'a', toggle: 'clicked' }],
    });
    expect(r.diagnostics).toEqual([]);
    const p = new Player(r.model!);
    p.pointer('down', ...at);
    p.pointer('up', ...at);
    p.step(0);
    expect(p.get('clicked')).toBe(expected);
  },
);
it('keeps clockwise hit winding local under reflection and leaves stroke containment intact', () => {
  const r = load({
    anima: '0.1',
    name: 'reflection',
    grid: 20,
    requires: ['contour'],
    nodes: [
      {
        id: 'a',
        type: 'path',
        d: 'M2 2H18V18H2Z',
        x: 20,
        scaleX: -1,
        fill: { color: '#000', winding: 'clockwise' },
        stroke: { color: '#000', width: 2 },
      },
    ],
    inputs: { clicked: { type: 'bool' } },
    listeners: [{ on: 'click', target: 'a', toggle: 'clicked' }],
  });
  const p = new Player(r.model!);
  for (const at of [
    [10, 10],
    [1.5, 10],
  ]) {
    p.pointer('down', at[0]!, at[1]!);
    p.pointer('up', at[0]!, at[1]!);
    p.step(0);
  }
  expect(p.get('clicked')).toBe(false); // both clicks hit and toggle
});
