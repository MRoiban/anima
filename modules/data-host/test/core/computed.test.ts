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
    local: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    root: { x: 2, y: 3, rotation: 0, scaleX: 2, scaleY: 2 },
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

it('decomposes resolved affine origins with pivots, reflection and zero scale', () => {
  const p = create({
    anima: '0.1',
    name: 'coordinates',
    grid: 20,
    nodes: [
      {
        id: 'parent',
        type: 'group',
        x: 10,
        y: 20,
        rotate: 90,
        scale: 2,
        children: [
          {
            id: 'child',
            type: 'circle',
            center: [0, 0],
            r: 1,
            x: 3,
            y: 4,
            pivot: [1, 0],
            rotate: 90,
            scaleX: 2,
            scaleY: -3,
          },
        ],
      },
      { id: 'zero', type: 'group', scaleX: 0, scaleY: 3 },
    ],
  });
  const value = p.computed('child');
  expect(value.local.x).toBeCloseTo(4);
  expect(value.local.y).toBeCloseTo(2);
  expect(value.local.rotation).toBeCloseTo(90);
  expect(value.local.scaleX).toBeCloseTo(2);
  expect(value.local.scaleY).toBeCloseTo(-3);
  expect(value.root.x).toBeCloseTo(6);
  expect(value.root.y).toBeCloseTo(28);
  expect(value.root.rotation).toBeCloseTo(180);
  expect(value.root.scaleX).toBeCloseTo(4);
  expect(value.root.scaleY).toBeCloseTo(-6);
  expect(p.computed('zero').local).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 0, scaleY: 3 });
  expect(Object.isFrozen(value.local) && Object.isFrozen(value.root)).toBe(true);
});
