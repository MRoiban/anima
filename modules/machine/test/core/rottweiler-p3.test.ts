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

// Rottweiler P3 R5-02: a transition out of a restored blend samples it with the resume offset.
it('keeps the restored blend clock through exit captures and continued fades', () => {
  const create = (exit: 'exit' | 'continue') => {
    const { model, diagnostics } = load({
      anima: '0.1',
      name: 'restored-exit',
      grid: 20,
      requires: ['machine'],
      inputs: { go: { type: 'trigger' } },
      nodes: [{ id: 'a', type: 'circle', center: [0, 0], r: 1, fill: { color: '#000' } }],
      timelines: {
        primary: { duration: 1, loop: 'once', tracks: {} },
        child: {
          duration: 2,
          loop: 'loop',
          tracks: {
            'a.x': [
              [0, 0],
              [2, 20],
            ],
          },
        },
      },
      machine: {
        layers: {
          l: {
            initial: 'blend',
            states: {
              blend: {
                play: 'primary',
                mix: {
                  mode: 'direct',
                  children: [
                    { play: 'child', at: 0, weight: 1 },
                    { play: 'primary', at: 1, weight: 0 },
                  ],
                },
                on: [
                  {
                    when: 'go',
                    to: 'out',
                    ...(exit === 'continue' ? { continue: true, blend: 1 } : {}),
                  },
                ],
              },
              out: exit === 'exit' ? { kind: 'exit', pose: {} } : { pose: { 'a.x': 0 } },
            },
          },
        },
      },
    });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    return new Player(model!, { reducedMotion: true });
  };
  for (const exit of ['exit', 'continue'] as const) {
    const p = create(exit);
    p.step(0);
    p.step(0.5);
    p.reducedMotion = false;
    p.step(0.25);
    expect(p.value('a.x')).toBeCloseTo(2.5, 9);
    p.fire('go');
    p.step(0);
    expect(p.value('a.x')).toBeCloseTo(2.5, 9);
    p.step(0.25);
    expect(p.value('a.x')).toBeCloseTo(exit === 'exit' ? 2.5 : 3.75, 9);
  }
});
