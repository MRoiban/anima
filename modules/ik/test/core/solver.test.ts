import '@anima-format/core/all';
import { describe, expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';
import { compile } from '@anima-format/markup';

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
const strengths = [0, 0.25, 0.5, 0.75, 1] as const;

const halfStrengthRepro = `<anima version="0.1" name="ikhalf" grid="40" viewBox="0 0 40 30" requires="rig ik">
  <group id="aim" x="14" y="26"/>
  <bone id="upper" length="9" x="8" y="20">
    <bone id="fore" length="8"><ik target="aim" bones="2" bend="cw" strength="0.5"/></bone>
  </bone>
</anima>`;

const fromMarkup = (source: string): Player => {
  const built = compile(source);
  expect(built.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = player(built.doc!);
  p.step(0);
  return p;
};

function expectConnected(p: Player, chain: readonly [string, number][]): void {
  for (let i = 0; i < chain.length; i++) {
    const [id, length] = chain[i]!,
      start: [number, number] = [value(p, id + '.world.x'), value(p, id + '.world.y')],
      end = tip(p, id);
    expect(Math.hypot(end[0] - start[0], end[1] - start[1])).toBeCloseTo(length, 10);
    if (i) {
      const parentTip = tip(p, chain[i - 1]![0]);
      expect(Math.hypot(start[0] - parentTip[0], start[1] - parentTip[1])).toBeLessThanOrEqual(
        1e-9,
      );
    }
  }
}

describe('ik solver', () => {
  it('keeps partially-strengthened two- and three-bone chains connected', () => {
    for (const strength of strengths) {
      const two = fromMarkup(
        strength === 0.5
          ? halfStrengthRepro
          : halfStrengthRepro.replace('strength="0.5"', `strength="${strength}"`),
      );
      expectConnected(two, [
        ['upper', 9],
        ['fore', 8],
      ]);
      if (strength === 0) {
        expect([value(two, 'upper.world.x'), value(two, 'upper.world.y')]).toEqual([8, 20]);
        expect(tip(two, 'upper')).toEqual([17, 20]);
        expect([value(two, 'fore.world.x'), value(two, 'fore.world.y')]).toEqual([17, 20]);
        expect(tip(two, 'fore')).toEqual([25, 20]);
      }
      if (strength === 1) {
        expect(tip(two, 'fore')[0]).toBeCloseTo(14, 10);
        expect(tip(two, 'fore')[1]).toBeCloseTo(26, 10);
      }

      const three =
        fromMarkup(`<anima version="0.1" name="ikthree" grid="40" viewBox="0 0 40 30" requires="rig ik">
  <group id="aim" x="18" y="25"/>
  <bone id="a" length="6" x="8" y="20">
    <bone id="b" length="5">
      <bone id="c" length="4"><ik target="aim" bones="3" bend="cw" strength="${strength}"/></bone>
    </bone>
  </bone>
</anima>`);
      expectConnected(three, [
        ['a', 6],
        ['b', 5],
        ['c', 4],
      ]);
      if (strength === 0) {
        expect([value(three, 'a.world.x'), value(three, 'a.world.y')]).toEqual([8, 20]);
        expect(tip(three, 'a')).toEqual([14, 20]);
        expect([value(three, 'b.world.x'), value(three, 'b.world.y')]).toEqual([14, 20]);
        expect(tip(three, 'b')).toEqual([19, 20]);
        expect([value(three, 'c.world.x'), value(three, 'c.world.y')]).toEqual([19, 20]);
        expect(tip(three, 'c')).toEqual([23, 20]);
      }
      if (strength === 1) {
        expect(tip(three, 'c')[0]).toBeCloseTo(18, 8);
        expect(tip(three, 'c')[1]).toBeCloseTo(25, 8);
      }
    }
  });

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
  it('skips the chain when the first bone authored scale is zero but a prior constraint repairs it', () => {
    const p =
      fromMarkup(`<anima version="0.1" name="r21" grid="40" viewBox="0 0 40 30" requires="rig ik">
  <group id="src" scale="1"/>
  <group id="target" x="10" y="10"/>
  <bone id="root" length="10" x="0" y="0">
    <copy-scale from="src"/>
    <bone id="tip" length="10"><ik target="target" bones="2"/></bone>
  </bone>
  <timeline name="collapse" duration="1"><track target="root.scale">0 1; 1 0</track></timeline>
  <layer name="l" initial="s"><state name="s" play="collapse"/></layer>
</anima>`);
    expect(() => p.step(1)).not.toThrow();
    expect(Number.isFinite(value(p, 'tip.world.x'))).toBe(true);
  });
  it('skips a chain whose inverse overflows on a subnormal scale', () => {
    for (const scaleX of [1e-309, Number.MIN_VALUE]) {
      let p: Player | undefined;
      expect(() => {
        p = player(
          scene(
            bone('arm', 1, { scaleX, constraints: [{ kind: 'ik', target: 'target', bones: 1 }] }),
            target(1, 1),
          ),
        );
        p.step(0);
      }).not.toThrow();
      for (const v of Object.values(p!.values()))
        if (typeof v === 'number') expect(Number.isNaN(v)).toBe(false);
    }
  });
  it('skips a chain whose bones collapse to zero scale instead of throwing', () => {
    const p =
      fromMarkup(`<anima version="0.1" name="r11" grid="40" viewBox="0 0 40 30" requires="rig ik">
  <group id="target" x="10" y="10"/>
  <bone id="root" length="10" x="0" y="0">
    <bone id="tip" length="10"><ik target="target" bones="2"/></bone>
  </bone>
  <timeline name="collapse" duration="1"><track target="root.scale">0 1; 1 0</track></timeline>
  <layer name="l" initial="s"><state name="s" play="collapse"/></layer>
</anima>`);
    expect(() => {
      p.step(0.5);
      p.step(0.5);
    }).not.toThrow();
    expect(Number.isFinite(value(p, 'tip.world.x'))).toBe(true);
  });
});
