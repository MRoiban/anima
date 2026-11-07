import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { create } from './fixture.ts';
it('returns frozen, detached world geometry and multiplied opacity without advancing time', () => {
  const p = create({
    anima: '0.1',
    name: 'computed',
    grid: 20,
    nodes: [
      {
        id: 'parent',
        type: 'group',
        x: 2,
        y: 3,
        scale: 2,
        opacity: 0.5,
        children: [{ id: 'dot', type: 'circle', center: [1, 2], r: 3, opacity: 0.4 }],
      },
    ],
  });
  const before = p.values(),
    value = p.computed('dot');
  expect(value).toEqual({
    world: [2, 0, 0, 2, 2, 3],
    bounds: { x: -2, y: 1, width: 12, height: 12 },
    opacity: 0.2,
  });
  expect(p.computed('parent').bounds).toEqual(value.bounds);
  expect(p.values()).toEqual(before);
  expect(
    Object.isFrozen(value) && Object.isFrozen(value.world) && Object.isFrozen(value.bounds),
  ).toBe(true);
  expect(() => p.computed('missing')).toThrow(
    expect.objectContaining({
      code: 'data-path',
      pointer: '/data/missing',
      hint: expect.any(String),
    }),
  );
});

it('uses cubic extrema rather than control hulls or sampled points for path bounds', () => {
  const p = create({
    anima: '0.1',
    name: 'curve',
    grid: 20,
    nodes: [{ id: 'curve', type: 'path', d: 'M0 0 C0 10 10 10 10 0', x: 2, scale: 2 }],
  });
  expect(p.computed('curve').bounds).toEqual({ x: 2, y: 0, width: 20, height: 15 });
});
