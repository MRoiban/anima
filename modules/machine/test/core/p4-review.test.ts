// Regression tests for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

const dot = (extra: object = {}) => ({
  id: 'dot',
  type: 'circle',
  center: [10, 10],
  r: 1,
  fill: { color: '#000' },
  ...extra,
});
const direct = (children: object[]) => ({
  layers: { l: { initial: 'a', states: { a: { play: 't', mix: { mode: 'direct', children } } } } },
});
const model = (doc: object) => {
  const r = load({ anima: '0.1', name: 'p4', grid: 20, ...doc });
  expect(
    r.diagnostics.filter((d) => d.severity === 'error').map((d) => [d.code, d.pointer, d.message]),
  ).toEqual([]);
  return r.model!;
};

it('R1-01: blend children sample data-bound keyframes with the owning player', () => {
  const p = new Player(
    model({
      requires: ['machine', 'motion', 'data'],
      nodes: [dot()],
      timelines: {
        t: {
          duration: 1,
          tracks: {
            'dot.x': [
              [0, '$peak'],
              [1, '$peak'],
            ],
          },
        },
      },
      machine: direct([{ play: 't', weight: 1 }]),
      data: { models: { M: { properties: { peak: { type: 'number', default: 10 } } } } },
    }),
  );
  p.step(0);
  expect(p.value('dot.x')).toBe(10);
});

it('R1-02: blend states hold discrete channels instead of interpolating them', () => {
  const p = new Player(
    model({
      requires: ['machine', 'motion'],
      nodes: [
        dot({ channels: { n: { type: 'int', value: 0 }, s: { type: 'string', value: 'idle' } } }),
      ],
      timelines: {
        t: {
          duration: 1,
          tracks: {
            'dot.channels.n': [
              [0, 3],
              [1, 3],
            ],
            'dot.channels.s': [
              [0, 'test'],
              [1, 'test'],
            ],
          },
        },
      },
      machine: direct([{ play: 't', weight: 0.5 }]),
    }),
  );
  p.step(0);
  expect([0, 3]).toContain(p.value('dot.channels.n'));
  expect(['idle', 'test']).toContain(p.value('dot.channels.s'));
});

it('R1-07: custom string property tracks hold and never reach path interpolation', () => {
  const p = new Player(
    model({
      requires: ['machine', 'data'],
      nodes: [dot({ properties: { label: 'idle' } })],
      timelines: {
        t: {
          duration: 1,
          tracks: {
            'dot.properties.label': [
              [0, 'idle', 'hold'],
              [1, 'done'],
            ],
          },
        },
      },
      machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
      data: { models: { M: { properties: { x: { type: 'number', default: 0 } } } } },
    }),
  );
  p.step(0.5);
  expect(p.value('dot.properties.label')).toBe('idle');
  p.step(0.5);
  expect(p.value('dot.properties.label')).toBe('done');
});

it('R1-04: machine action groups assign string and colour data destinations', () => {
  const p = new Player(
    model({
      requires: ['machine', 'data', 'bind'],
      nodes: [dot()],
      machine: {
        layers: {
          l: {
            initial: 'a',
            states: {
              a: {
                pose: { 'dot.x': 0 },
                enterActions: { set: { $title: '"done"', $tint: '#ff0000' } },
              },
            },
          },
        },
      },
      data: {
        models: {
          M: {
            properties: {
              title: { type: 'string', default: 'idle' },
              tint: { type: 'color', default: '#000000' },
            },
          },
        },
      },
    }),
  );
  p.step(0);
  expect(p.get('$title')).toBe('done');
  expect(p.get('$tint')).toEqual([255, 0, 0, 255]);
});

it('R4-01: any-state edges keep priority over a random state’s weighted pick', () => {
  for (const machineSeed of [1, 2, 3, 4, 5]) {
    const p = new Player(
      model({
        requires: ['machine'],
        nodes: [dot()],
        inputs: { go: { type: 'trigger' } },
        machineSeed,
        machine: {
          layers: {
            l: {
              initial: 'a',
              states: {
                a: { kind: 'random', pose: {}, on: [{ when: 'go', to: 'local', weight: 100 }] },
                anywhere: {
                  kind: 'any',
                  pose: {},
                  on: [{ when: 'go', to: 'inherited', weight: 1 }],
                },
                local: { pose: { 'dot.x': 5 } },
                inherited: { pose: { 'dot.x': 10 } },
              },
            },
          },
        },
      }),
    );
    p.step(0);
    p.fire('go');
    p.step(0);
    expect(p.states()).toEqual({ l: 'inherited' });
  }
});
