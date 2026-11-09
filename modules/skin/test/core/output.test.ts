import '@anima-format/core/all';
import { describe, expect, it } from 'vitest';
import { drawFrame, load, Player } from '@anima-format/core';

const full = { point: { arm: 1 } };
const doc = () => ({
  anima: '0.1',
  name: 'skin-output',
  grid: 20,
  requires: ['contour', 'rig', 'skin'],
  nodes: [
    { id: 'arm', type: 'bone', length: 10 },
    {
      id: 'path',
      type: 'path',
      d: 'M0 0L10 0L10 2L0 2Z',
      fill: { color: '#000' },
      skin: { bones: ['arm'], weights: [full, full, full, full] },
    },
    {
      id: 'contour',
      type: 'contour',
      vertices: [
        { point: [0, 3], kind: 'straight' },
        { point: [10, 3], kind: 'straight' },
        { point: [10, 4], kind: 'straight' },
        { point: [0, 4], kind: 'straight' },
      ],
      closed: true,
      fill: { color: '#000' },
      skin: { bones: ['arm'], weights: [full, full, full, full] },
    },
  ],
  timelines: {
    move: {
      duration: 1,
      tracks: {
        'arm.rotate': [
          [0, 0],
          [1, 90],
        ],
        'path.x': [
          [0, 0],
          [1, 6],
        ],
      },
    },
  },
  machine: { layers: { main: { initial: 'move', states: { move: { play: 'move' } } } } },
  listeners: [{ on: 'down', target: 'path', emit: 'hit' }],
});

const player = () => {
  const result = load(doc());
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
};

describe('skinned drawing and hits', () => {
  it('publishes deformed path and contour geometry while keeping the skinned node at its rest frame', () => {
    const p = player();
    p.step(1);
    const frame = drawFrame(p);
    expect(frame.nodes[1]!.geometry!.d).toBe('M0 0L0 10L-2 10L-2 0Z');
    expect(frame.nodes[2]!.geometry!.d).toBe('M-3 0L-3 10L-4 10L-4 0L-3 0Z');
    expect(frame.nodes[1]!.transform).toEqual([1, 0, 0, 1, 0, 0]);
    expect(p.value('path.x')).toBe(6);
    const point = p.values()['path.skin.point.1'] as [number, number];
    expect(point[0]).toBeCloseTo(0);
    expect(point[1]).toBeCloseTo(10);
  });

  it('uses the deformed paint outline for pointer hits', () => {
    const p = player();
    p.step(1);
    expect(p.hits(p.model.listeners[0]!, -1, 5)).toBe(true);
    expect(p.hits(p.model.listeners[0]!, 5, 1)).toBe(false);
  });
});
