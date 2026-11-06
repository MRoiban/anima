import { expect, it } from 'vitest';
import { load, Player } from '../src/index.ts';

const make = (overrides: object = {}) => {
  const result = load({
    anima: '0.1',
    name: 'boundaries',
    grid: 20,
    nodes: [{ id: 'a', type: 'circle', center: [0, 0], r: 1 }],
    timelines: {
      t: {
        duration: 1,
        events: [
          [0.25, 'quarter'],
          [0.5, 'half'],
          [1, 'end'],
        ],
        tracks: {
          'a.x': [
            [0, 0, 'hold'],
            [0.25, 10, 'hold'],
            [0.5, 20, 'hold'],
            [1, 30],
          ],
          'a.visible': [
            [0, true],
            [0.25, false],
            [0.5, true],
          ],
        },
      },
    },
    machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
    ...overrides,
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
};

it('recognizes event, hold/bool key and completion on 60 Hz boundaries exactly once', () => {
  const p = make();
  const reports: [number, string][] = [];
  for (let frame = 1; frame <= 61; frame++) {
    const result = p.step(1 / 60);
    reports.push(...result.events.map((e): [number, string] => [frame, e.name]));
    if (frame === 15) {
      expect(p.value('a.x')).toBe(10);
      expect(p.value('a.visible')).toBe(false);
    }
    if (frame === 30) expect(p.value('a.x')).toBe(20);
    if (frame === 60) {
      expect(p.value('a.x')).toBe(30);
      expect(result.settled).toBe(true);
    }
    expect(p.step(0).events).toEqual([]);
  }
  expect(reports).toEqual([
    [15, 'quarter'],
    [30, 'half'],
    [60, 'end'],
  ]);
});

it('distinguishes outside/inside epsilon, does not duplicate an early event, preserves tiny keys', () => {
  const p = make();
  expect(p.step(0.25 - 2e-9).events).toEqual([]);
  expect(p.value('a.x')).toBe(0);
  expect(p.step(1.5e-9).events.map((e) => e.name)).toEqual(['quarter']);
  expect(p.value('a.x')).toBe(10);
  expect(p.step(0).events).toEqual([]);
  expect(p.step(1e-9).events).toEqual([]);
  const tiny = make({
    timelines: {
      t: {
        duration: 1,
        tracks: {},
        events: [
          [0.25, 'one'],
          [0.2500000005, 'two'],
        ],
      },
    },
  });
  expect(tiny.step(0.25).events.map((e) => e.name)).toEqual(['one', 'two']);
  expect(tiny.step(2e-9).events).toEqual([]);
});

it('ends a locked fade and evaluates after at frames 30 and 45', () => {
  const p = make({
    machine: {
      layers: {
        l: {
          initial: 's',
          states: {
            s: {
              pose: { 'a.x': 0 },
              on: [{ when: '@after(0.5)', to: 'blend', blend: 0.25, interruptible: false }],
            },
            blend: { pose: { 'a.x': 10 }, emit: 'begin', on: [{ when: '@after(0)', to: 'done' }] },
            done: { pose: { 'a.x': 20 }, emit: 'done' },
          },
        },
      },
    },
  });
  const reports: [number, string][] = [];
  for (let f = 1; f <= 46; f++)
    reports.push(...p.step(1 / 60).events.map((e): [number, string] => [f, e.name]));
  expect(reports).toEqual([
    [30, 'begin'],
    [45, 'done'],
  ]);
});

it('uses played seconds for a sped-up once end, clamping early carry to zero', () => {
  const p = make({
    machine: {
      layers: {
        l: {
          initial: 's',
          states: {
            s: { play: 't', speed: 2, on: [{ when: '@end', to: 'end' }] },
            end: { pose: {}, emit: 'finished', on: [{ when: '@after(0.1)', to: 'after' }] },
            after: { pose: {}, emit: 'after' },
          },
        },
      },
    },
  });
  p.step(0.5 - 1e-9); // played time is still outside epsilon
  expect(p.states().l).toBe('s');
  expect(p.step(0.75e-9).events.map((e) => e.name)).toEqual(['end', 'finished']);
  expect(p.step(0).events).toEqual([]);
  expect(p.step(0.1).events.map((e) => e.name)).toEqual(['after']);
});

it('keeps a buffered trigger at its epsilon boundary and expires it strictly later', () => {
  const p = make({
    inputs: { go: { type: 'trigger', buffer: 0.5 }, ready: { type: 'bool' } },
    machine: {
      layers: {
        l: {
          initial: 's',
          states: {
            s: { pose: {}, on: [{ when: 'go && ready', to: 'done' }] },
            done: { pose: {} },
          },
        },
      },
    },
  });
  p.fire('go');
  p.step(0.5 + 0.5e-9);
  p.set('ready', true);
  p.step(0);
  expect(p.states().l).toBe('done');
  const expired = make({
    inputs: { go: { type: 'trigger', buffer: 0.5 } },
    machine: { layers: { l: { initial: 's', states: { s: { pose: {} } } } } },
  });
  expired.fire('go');
  expect(expired.step(0.5 + 2e-9).settled).toBe(true);
});

it('reports each decimal pingpong turn once across many carried periods', () => {
  const p = make({
    timelines: {
      t: {
        duration: 0.1,
        loop: 'pingpong',
        tracks: {},
        events: [
          [0, 'start'],
          [0.1, 'end'],
        ],
      },
    },
  });
  expect(p.step(0).events.map((e) => e.name)).toEqual(['start']);
  expect(p.step(2).events.map((e) => e.name)).toEqual(
    Array.from({ length: 10 }, () => ['end', 'start']).flat(),
  );
  expect(p.step(0).events).toEqual([]);
});
