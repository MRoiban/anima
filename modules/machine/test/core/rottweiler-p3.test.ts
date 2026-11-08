import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

// Rottweiler P3 R2-04: restoring full motion resumes blend children frozen at state entry.
it('resumes blend children when reduced motion is turned off', () => {
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'reduced-blend',
    grid: 20,
    requires: ['machine'],
    nodes: [{ id: 'dot', type: 'circle', center: [0, 0], r: 1, fill: { color: '#000' } }],
    timelines: {
      t: {
        duration: 1,
        loop: 'loop',
        tracks: {
          'dot.x': [
            [0, 0],
            [1, 10],
          ],
        },
      },
    },
    machine: {
      layers: {
        main: {
          initial: 'a',
          states: {
            a: { play: 't', mix: { mode: 'direct', children: [{ play: 't', at: 0, weight: 1 }] } },
          },
        },
      },
    },
  });
  expect(diagnostics).toEqual([]);
  const p = new Player(model!, { reducedMotion: true });
  p.step(0);
  expect(p.value('dot.x')).toBe(10);
  p.reducedMotion = false;
  p.step(0.25);
  expect(p.value('dot.x')).toBeCloseTo(2.5, 9);
  p.step(0.25);
  expect(p.value('dot.x')).toBeCloseTo(5, 9);
});
