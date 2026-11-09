import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

const make = (offsetY = 0, extra: object = {}) => {
  const result = load({
    anima: '0.1',
    name: 'scroll-runtime',
    grid: 20,
    requires: ['rig', 'input', 'scroll'],
    nodes: [
      { id: 'viewport', type: 'rect', x0: 0, y0: 0, w: 10, h: 10 },
      {
        id: 'content',
        type: 'group',
        constraints: [{ kind: 'scroll', viewport: 'viewport', axis: 'y', offsetY }],
        children: [{ id: 'body', type: 'rect', x0: 0, y0: 0, w: 10, h: 30 }],
      },
    ],
    ...extra,
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
};

it('clamps authored offsets and publishes scroll percentages', () => {
  const p = make(99);
  expect(p.values()['content.world.y']).toBe(-20);
  expect(p.values()['content.constraints.0.percentY']).toBe(1);
});

it('lets a bound offset override player-local scroll state each step', () => {
  const p = make(0, {
    requires: ['rig', 'input', 'scroll', 'bind'],
    inputs: { y: { type: 'number', default: 4 } },
    bind: { 'content.constraints.0.offsetY': 'y' },
  });
  p.step(0);
  expect(p.values()['content.world.y']).toBe(-4);
  p.set('y', 8);
  p.step(0);
  expect(p.values()['content.world.y']).toBe(-8);
});
