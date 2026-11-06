import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

const make = (extra: object = {}) => {
  const result = load({
    anima: '0.1',
    name: 'boundary',
    grid: 20,
    requires: ['motion'],
    nodes: [{ id: 'a', type: 'circle', center: [0, 0], r: 1 }],
    timelines: {
      t: {
        duration: 1,
        tracks: {
          'a.x': [
            [0, 0],
            [1, 100],
          ],
        },
      },
    },
    ...extra,
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
};

it.each([0.5, 2])(
  'uses the same source-clock completion epsilon with/without motion at speed %s',
  (speed) => {
    for (const requires of [[], ['motion']]) {
      const p = make({
        requires,
        machine: {
          layers: {
            l: {
              initial: 's',
              states: {
                s: { play: 't', speed, on: [{ when: '@end', to: 'done' }] },
                done: { pose: {}, emit: 'done' },
              },
            },
          },
        },
      });
      expect(p.step((1 - 2e-9) / speed).events).toEqual([]);
      expect(p.states().l).toBe('s');
      expect(p.step(1.5e-9 / speed).events.map((e) => e.name)).toEqual(['done']);
      expect(p.step(0).events).toEqual([]);
    }
  },
);

it('crosses reverse keys once at frames 15/30/60 and samples discrete/value-curve keys', () => {
  const p = make({
    nodes: [
      { id: 'a', type: 'circle', center: [0, 0], r: 1, channels: { n: { type: 'int', value: 0 } } },
    ],
    timelines: {
      t: {
        duration: 1,
        speed: -1,
        events: [
          [0, 'zero'],
          [0.5, 'half'],
          [0.75, 'quarter'],
        ],
        tracks: {
          'a.channels.n': [
            [0, 0],
            [0.5, 1],
            [0.75, 2],
          ],
          'a.x': [
            [0, 0, 'value-cubic(0.2,0,0.8,100)'],
            [0.75, 100],
            [1, 100],
          ],
        },
      },
    },
    machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
  });
  const events: [number, string][] = [];
  for (let f = 1; f <= 61; f++) {
    const result = p.step(1 / 60);
    events.push(...result.events.map((e): [number, string] => [f, e.name]));
    if (f === 15) {
      expect(p.value('a.channels.n')).toBe(2);
      expect(p.value('a.x')).toBe(100);
    }
    if (f === 30) expect(p.value('a.channels.n')).toBe(1);
    if (f === 60) expect(result.settled).toBe(true);
    expect(p.step(0).events).toEqual([]);
  }
  expect(events).toEqual([
    [15, 'quarter'],
    [30, 'half'],
    [60, 'zero'],
  ]);
});

it.each([1, -1])(
  'finishes an independent work-area instance with speed %s without repeat reports',
  (speed) => {
    const p = make({
      timelines: {
        t: {
          duration: 1,
          work: [0.2, 0.7],
          quantize: 10,
          tracks: {
            'a.x': [
              [0, 0],
              [1, 100],
            ],
          },
          events: [
            [0.2, 'lo'],
            [0.7, 'hi'],
          ],
        },
      },
    });
    const t = p.createTimeline('t', { speed });
    expect(t.advance(0).map((e) => e.name)).toEqual([speed > 0 ? 'lo' : 'hi']);
    t.advance(0.5 - 2e-9);
    expect(t.finished).toBe(false);
    expect(t.advance(1.5e-9).map((e) => e.name)).toEqual([speed > 0 ? 'hi' : 'lo']);
    expect(t.finished).toBe(true);
    expect(t.didLoop).toBe(true);
    expect(t.time).toBe(speed > 0 ? 0.7 : 0.2);
    expect(t.advance(0)).toEqual([]);
    expect(t.didLoop).toBe(false);
    p.step(0);
    expect(p.value('a.x')).toBeCloseTo(speed > 0 ? 70 : 20, 12);
  },
);

it.each(['loop', 'pingpong'] as const)(
  'recognizes instance %s wraps and turns on each 30th frame',
  (loop) => {
    const p = make({ timelines: { t: { duration: 1, work: [0.2, 0.7], loop, tracks: {} } } });
    const t = p.createTimeline('t');
    for (let f = 1; f <= 120; f++) {
      t.advance(1 / 60);
      expect(t.didLoop, `frame ${f}`).toBe(f % 30 === 0);
      if (f % 30 === 0) expect(t.time).toBeCloseTo(loop === 'pingpong' && f % 60 ? 0.7 : 0.2, 12);
    }
  },
);

it.each(['step', 'loop'] as const)(
  'arms exitNext %s immediately at a boundary within epsilon',
  (exitNext) => {
    const p = make({
      inputs: { stop: { type: 'bool' } },
      timelines: {
        t: {
          duration: 1,
          loop: 'loop',
          quantize: 4,
          tracks: {
            'a.x': [
              [0, 0],
              [1, 100],
            ],
          },
        },
      },
      machine: {
        layers: {
          l: {
            initial: 's',
            states: {
              s: { play: 't', on: [{ when: 'stop', to: 'held', sync: true, exitNext }] },
              held: { play: 't', hold: true },
            },
          },
        },
      },
    });
    p.step((exitNext === 'step' ? 0.25 : 1) - 0.5e-9);
    p.set('stop', true);
    expect(p.step(0).settled).toBe(true);
    expect(p.states().l).toBe('held');
    expect(p.value('a.x')).toBe(exitNext === 'step' ? 25 : 0);
  },
);

it('retains a reached off-grid work endpoint before sample quantization', () => {
  const p = make({
    timelines: {
      t: {
        duration: 1,
        work: [0.2, 0.75],
        loop: 'pingpong',
        quantize: 10,
        tracks: {
          'a.x': [
            [0, 0],
            [1, 100],
          ],
        },
      },
    },
    machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
  });
  for (let f = 0; f < 33; f++) p.step(1 / 60);
  expect(p.inspect()[0]!.time).toBe(0.75);
  expect(p.value('a.x')).toBe(75);
  p.step(0);
  expect(p.value('a.x')).toBe(75);
});

it('deduplicates decimal pingpong turns by occurrence, preserving distinct authored endpoints', () => {
  const p = make({
    timelines: {
      t: {
        duration: 1,
        work: [0.2, 0.75],
        loop: 'pingpong',
        tracks: {},
        events: [
          [0.2, 'start'],
          [0.75, 'end'],
        ],
      },
    },
    machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
  });
  expect(p.step(0).events.map((e) => e.name)).toEqual(['start']);
  expect(p.step(1.1).events.map((e) => e.name)).toEqual(['end', 'start']);
  expect(p.step(0).events).toEqual([]);
});
