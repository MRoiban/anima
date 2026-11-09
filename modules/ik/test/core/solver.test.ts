import '@anima-format/core/all';
import { describe, expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

const bone = (id: string, length: number, extra: object = {}) => ({
  id,
  type: 'bone',
  length,
  ...extra,
});
const target = (x: number, y: number, extra: object = {}) => ({
  id: 'target',
  type: 'group',
  x,
  y,
  ...extra,
});
const scene = (arm: object, aim: object = target(6, 4)) => ({
  anima: '0.1',
  name: 'ik-solver',
  grid: 20,
  requires: ['rig', 'ik'],
  nodes: [arm, aim],
});
const player = (raw: object) => {
  const r = load(raw);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
};
const value = (p: Player, key: string): number => p.values()[key] as number;
const tip = (p: Player, id: string): [number, number] => [
  value(p, id + '.tip.x'),
  value(p, id + '.tip.y'),
];
const bendSide = (p: Player, id: string, x: number, y: number) =>
  x * value(p, id + '.world.y') - y * value(p, id + '.world.x');

describe('ik solver', () => {
  it('aims one bone and straightens it toward an unreachable target', () => {
    const p = player(
      scene(
        bone('arm', 5, { x: 1, y: 2, constraints: [{ kind: 'ik', target: 'target' }] }),
        target(9, 8),
      ),
    );
    const t = tip(p, 'arm'),
      d = Math.hypot(8, 6);
    expect(t[0]).toBeCloseTo(1 + (8 / d) * 5, 10);
    expect(t[1]).toBeCloseTo(2 + (6 / d) * 5, 10);
  });

  it('solves two bones analytically on either bend side', () => {
    for (const [bend, side] of [
      ['cw', 1],
      ['ccw', -1],
    ] as const) {
      const p = player(
        scene(
          bone('upper', 5, {
            children: [
              bone('fore', 4, { constraints: [{ kind: 'ik', target: 'target', bones: 2, bend }] }),
            ],
          }),
          target(6, 4),
        ),
      );
      expect(tip(p, 'fore')[0]).toBeCloseTo(6, 10);
      expect(tip(p, 'fore')[1]).toBeCloseTo(4, 10);
      expect(Math.sign(bendSide(p, 'fore', 6, 4))).toBe(side);
    }
  });

  it('flips the two-bone bend under a mirrored ancestor', () => {
    const p = player(
      scene(
        {
          id: 'mirror',
          type: 'group',
          scaleX: -1,
          children: [
            bone('upper', 5, {
              children: [
                bone('fore', 4, {
                  constraints: [{ kind: 'ik', target: 'target', bones: 2, bend: 'cw' }],
                }),
              ],
            }),
          ],
        },
        target(-6, 4),
      ),
    );
    expect(tip(p, 'fore')[0]).toBeCloseTo(-6, 10);
    expect(tip(p, 'fore')[1]).toBeCloseTo(4, 10);
    expect(bendSide(p, 'fore', -6, 4)).toBeLessThan(0);
  });

  it('uses a fixed iterative solve for three bones and preserves segment lengths', () => {
    const p = player(
      scene(
        bone('a', 4, {
          children: [
            bone('b', 3, {
              children: [
                bone('c', 2, { constraints: [{ kind: 'ik', target: 'target', bones: 3 }] }),
              ],
            }),
          ],
        }),
        target(5, 5),
      ),
    );
    expect(tip(p, 'c')[0]).toBeCloseTo(5, 8);
    expect(tip(p, 'c')[1]).toBeCloseTo(5, 8);
    for (const [parent, child, length] of [
      ['a', 'b', 4],
      ['b', 'c', 3],
    ] as const) {
      const dx = value(p, child + '.world.x') - value(p, parent + '.world.x');
      const dy = value(p, child + '.world.y') - value(p, parent + '.world.y');
      expect(Math.hypot(dx, dy)).toBeCloseTo(length, 8);
    }
  });

  it('leaves a coincident target at the chain start in its rest pose', () => {
    const p = player(
      scene(
        bone('upper', 5, {
          rotate: 20,
          children: [
            bone('fore', 4, {
              rotate: 15,
              constraints: [{ kind: 'ik', target: 'target', bones: 2 }],
            }),
          ],
        }),
        target(0, 0),
      ),
    );
    expect(value(p, 'upper.world.rotate')).toBeCloseTo(20, 10);
    expect(value(p, 'fore.world.rotate')).toBeCloseTo(35, 10);
  });
});
