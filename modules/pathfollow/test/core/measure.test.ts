import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { pathMeasure } from '../../core/measure.ts';

const player = (node: object) =>
  new Player(load({ anima: '0.1', name: 'measure', grid: 20, nodes: [node] }).model!);

it('measures straight paths by natural length', () => {
  const p = player({ id: 'path', type: 'path', d: 'M2 3L10 3' });
  expect(pathMeasure(p, 0)!.at(0.25)).toEqual([4, 3, 8, 0]);
});

it('samples circular outlines exactly and wraps closed fractions', () => {
  const p = player({ id: 'ring', type: 'circle', center: [5, 6], r: 4 });
  const a = pathMeasure(p, 0)!;
  expect(a.at(0.25)!.slice(0, 2)).toEqual([5, 10]);
  expect(a.at(1.25)!.slice(0, 2)).toEqual([5, 10]);
  expect(a.at(0.25)![2]).toBeCloseTo(-1, 12);
});

it('clamps open arcs', () => {
  const p = player({ id: 'arc', type: 'arc', center: [0, 0], r: 2, from: 0, to: 90 });
  const a = pathMeasure(p, 0)!;
  expect(a.at(-1)!.slice(0, 2)).toEqual([2, 0]);
  expect(a.at(2)![0]).toBeCloseTo(0, 12);
  expect(a.at(2)![1]).toBeCloseTo(2, 12);
});
