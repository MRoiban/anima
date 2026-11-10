import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { drawFrame, load, Player } from '@anima-format/core';

// Rottweiler S1-1: a skin on a meshed image deforms the animated vertices, not the rest mesh.
const doc = (weights: boolean) => {
  const d = JSON.parse(readFileSync('spec/conformance/rigging-mesh-animation/case.ani', 'utf8'));
  d.requires.push('rig', 'skin');
  delete d.bind;
  delete d.inputs;
  d.nodes.unshift({ id: 'arm', type: 'bone', x: 2, y: 5, length: 8 });
  d.nodes[1].skin = {
    bones: ['arm'],
    ...(weights ? { weights: Array.from({ length: 6 }, () => ({ point: { arm: 1 } })) } : {}),
  };
  d.timelines = {
    wave: {
      duration: 1,
      tracks: {
        'flag.mesh.vertex.0': [
          [0, [2, 5]],
          [1, [5, 3]],
        ],
      },
    },
  };
  return d;
};

it('skins the animated mesh vertices, with explicit or automatic weights', () => {
  for (const weights of [true, false]) {
    const result = load(doc(weights));
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const p = new Player(result.model!);
    p.step(1);
    const points = drawFrame(p).nodes.find((n) => n.mesh)!.mesh!.points;
    expect(points[0]).toBeCloseTo(5, 8);
    expect(points[1]).toBeCloseTo(3, 8);
    expect(p.values()['flag.skin.point.0']).toEqual([5, 3]);
  }
});

it('computes automatic mesh weights from the rest vertices, whenever the first draw happens', () => {
  const d = doc(false);
  d.nodes.unshift({ id: 'other', type: 'bone', x: 2, y: 9, length: 8 });
  d.nodes[2].skin.bones.push('other');
  d.timelines.wave.tracks['arm.rotate'] = [
    [0, 0],
    [1, 30],
  ];
  const model = load(d).model!,
    early = new Player(model),
    late = new Player(model);
  drawFrame(early);
  early.step(1);
  late.step(1);
  expect(drawFrame(late).nodes.find((n) => n.mesh)!.mesh!.points).toEqual(
    drawFrame(early).nodes.find((n) => n.mesh)!.mesh!.points,
  );
});
