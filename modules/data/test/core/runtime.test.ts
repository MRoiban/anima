import { clone } from '../../core/types.ts';
import '@anima-format/core/all';
import { describe, it, expect } from 'vitest';
import { load, Player, runScript, toSVG } from '../../../../packages/core/src/index.ts';
import { dataState, registerConverter, systemEnums } from '../../core/index.ts';
import { registerFunction, expression, evaluate } from '../../../bind/core/expression.ts';
export const doc = (extra: Record<string, unknown> = {}) => ({
  anima: '0.1',
  name: 'data',
  grid: 20,
  requires: ['data', 'bind'],
  nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1, fill: { color: '#000' } }],
  data: {
    models: {
      Score: {
        properties: {
          score: { type: 'number', default: 2, min: 0, max: 20 },
          label: { type: 'string', default: 'Ada' },
          active: { type: 'bool' },
          tint: { type: 'color', default: '#11223344' },
          pulse: { type: 'trigger' },
          mood: { type: 'enum', values: ['calm', 'happy'] },
        },
      },
    },
    instances: {
      main: { model: 'Score', default: true, values: { score: 4 } },
      other: { model: 'Score', values: { score: 7 } },
    },
  },
  ...extra,
});
export function player(raw: object): Player {
  const r = load(raw);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(r.model).toBeDefined();
  return new Player(r.model!);
}
describe('data model storage and paths', () => {
  it('keeps typed values, aliases and player instances isolated; clamps numbers', () => {
    const p = player(doc()),
      q = new Player(p.model);
    expect(p.get('$score')).toBe(4);
    expect(p.get('$main:score')).toBe(4);
    expect(p.get('$other:score')).toBe(7);
    expect(p.get('$label')).toBe('Ada');
    expect(p.get('$tint')).toEqual([17, 34, 51, 68]);
    expect(p.get('$mood')).toBe('calm');
    p.set('$score', 30);
    p.step(0);
    expect(p.get('$main:score')).toBe(20);
    expect(q.get('$score')).toBe(4);
    expect(p.get('$other:score')).toBe(7);
    expect(() => p.set('$mood', 'invalid')).toThrow();
    expect(() => p.set('$score', 'bad')).toThrow();
  });
  it('reads nested model references, named references, heterogeneous list entries and read-only length', () => {
    const p = player(
      doc({
        data: {
          models: {
            Root: {
              properties: { team: { type: 'model-ref', model: 'Team' }, items: { type: 'list' } },
            },
            Team: { properties: { title: { type: 'string', default: 'Blue' } } },
            Item: { properties: { count: { type: 'number' } } },
          },
          instances: {
            main: {
              model: 'Root',
              default: true,
              values: {
                team: 'blue',
                items: [
                  { model: 'Item', values: { count: 9 } },
                  { model: 'Team', values: { title: 'Gold' } },
                ],
              },
            },
            blue: { model: 'Team' },
          },
        },
      }),
    );
    expect(p.get('$team.title')).toBe('Blue');
    expect(p.get('$items.0.count')).toBe(9);
    expect(p.get('$items.1.title')).toBe('Gold');
    expect(p.get('$items.length')).toBe(2);
    expect(() => p.set('$items.length', 3)).toThrow();
    const snapshot = clone(dataState(p)!.instances);
    (snapshot.main!.items as unknown[]).pop();
    expect(p.get('$items.length')).toBe(2);
  });
  it.each(Object.keys(systemEnums))('declares the %s system enum', (system) => {
    const p = player(
      doc({ data: { models: { Root: { properties: { value: { type: 'enum', system } } } } } }),
    );
    expect(p.get('$value')).toBe(systemEnums[system]![0]);
  });
  it('supports trigger aliases in conditions and state boundary actions', () => {
    const p = player(
      doc({
        machine: {
          layers: {
            main: {
              initial: 'idle',
              states: {
                idle: { pose: {}, on: [{ when: '$pulse', to: 'done' }] },
                done: { pose: { 'dot.x': 9 } },
              },
            },
          },
        },
      }),
    );
    p.fire('$pulse');
    p.step(0);
    expect(p.states()).toEqual({ main: 'done' });
    expect(p.value('dot.x')).toBe(9);
    expect(p.step(0).settled).toBe(true);
  });
});
describe('data binding modes', () => {
  const animation = {
    timelines: {
      move: {
        duration: 1,
        tracks: {
          'dot.x': [
            [0, 1],
            [1, 11],
          ],
        },
      },
    },
    machine: { layers: { main: { initial: 'move', states: { move: { play: 'move' } } } } },
  };
  it.each(['to-target', 'once', 'to-source', 'two-way'])('applies %s deterministically', (mode) => {
    const p = player(doc({ ...animation, bind: { 'dot.x': { value: '$score', mode } } }));
    p.step(0);
    expect(p.value('dot.x')).toBe(mode === 'to-source' ? 1 : 4);
    p.set('$score', 8);
    p.step(0.5);
    expect(p.value('dot.x')).toBe(mode === 'once' ? 4 : mode === 'to-source' ? 6 : 8);
    expect(p.get('$score')).toBe(mode === 'to-source' ? 6 : 8);
    p.step(0.5);
    expect(p.value('dot.x')).toBe(mode === 'to-target' ? 8 : mode === 'once' ? 4 : 11);
  });
  it.each(['source', 'target'])('resolves simultaneous changes preferring %s', (prefer) => {
    const p = player(
      doc({ ...animation, bind: { 'dot.x': { value: '$score', mode: 'two-way', prefer } } }),
    );
    p.step(0);
    p.set('$score', 8);
    p.step(0.5);
    expect(p.value('dot.x')).toBe(prefer === 'source' ? 8 : 6);
    expect(p.get('$score')).toBe(prefer === 'source' ? 8 : 6);
  });
  it('samples converters with live options and separate per-player state', () => {
    registerConverter('test-scale', (value, options, ctx) => {
      ctx.state.set('calls', Number(ctx.state.get('calls') ?? 0) + 1);
      return (
        Number(value) *
        (ctx.direction === 'reverse' ? 1 / Number(options.factor) : Number(options.factor))
      );
    });
    const p = player(
      doc({
        bind: {
          'dot.x': { value: '$score', convert: 'test-scale', options: { factor: '$other:score' } },
        },
      }),
    );
    p.step(0);
    expect(p.value('dot.x')).toBe(28);
    expect(dataState(p)!.converterState.get('calls')).toBe(1);
    expect(dataState(new Player(p.model))!.converterState.size).toBe(0);
  });
  it('registers math functions in the bind grammar', () => {
    registerFunction('testfn', 2, (x, y) => x * x + y);
    expect(
      evaluate(
        expression('testfn($score,2)', new Map([['$score', 'number']])),
        new Map([['$score', 3]]),
      ),
    ).toBe(11);
  });
  it('binds string/color/boolean custom properties and uses them as sources', () => {
    const p = player(
      doc({
        nodes: [
          {
            id: 'dot',
            type: 'circle',
            center: [10, 10],
            r: 1,
            properties: { label: '', flag: false, color: { type: 'color', default: '#000' }, n: 3 },
          },
        ],
        bind: {
          'dot.properties.label': '$label',
          'dot.properties.flag': '$active',
          'dot.properties.color': '$tint',
          'dot.x': { value: 'dot.properties.n * 2' },
        },
      }),
    );
    p.step(0);
    expect(p.value('dot.properties.label')).toBe('Ada');
    expect(p.value('dot.properties.flag')).toBe(false);
    expect(p.value('dot.properties.color')).toBe('#11223344');
    expect(p.value('dot.x')).toBe(6);
  });
  it('binds individual gradient stop channels', () => {
    const p = player(
      doc({
        requires: ['data', 'bind', 'paint'],
        nodes: [
          {
            id: 'dot',
            type: 'circle',
            center: [10, 10],
            r: 1,
            fill: {
              type: 'linear',
              x1: 0,
              y1: 0,
              x2: 20,
              y2: 0,
              stops: [
                { position: 0, color: '#000' },
                { position: 1, color: '#fff' },
              ],
            },
          },
        ],
        bind: { 'dot.fill.stops.0.red': '$score * 10' },
      }),
    );
    p.step(0);
    expect(toSVG(p)).toContain('#280000');
  });
});
describe('data writes and listeners', () => {
  it('copies and evaluates all action expressions against one pre-write snapshot', () => {
    const p = player(
      doc({
        listeners: [
          {
            on: 'click',
            set: { $score: '$score+1', '$other:score': '$score' },
            copy: '$label -> $other:label',
          },
        ],
      }),
    );
    p.pointer('down', 10, 10);
    p.pointer('up', 10, 10);
    p.step(0);
    expect(p.get('$score')).toBe(5);
    expect(p.get('$other:score')).toBe(4);
    expect(p.get('$other:label')).toBe('Ada');
  });
  it('queues change listeners for the following step, coalesces writes and sleeps after delivery', () => {
    const p = player(
      doc({ listeners: [{ on: 'change:$score', set: { '$other:score': '$other:score+1' } }] }),
    );
    p.set('$score', 5);
    p.set('$score', 6);
    expect(p.step(0).settled).toBe(false);
    expect(p.get('$other:score')).toBe(7);
    expect(p.step(0).settled).toBe(true);
    expect(p.get('$other:score')).toBe(8);
  });
  it('exposes typed data in event fields and selected sample snapshots', () => {
    const raw = doc({
      requires: ['data', 'bind', 'events'],
      eventDefs: {
        seen: {
          payload: {
            score: { type: 'number', input: '$score' },
            label: { type: 'string', input: '$label' },
            color: { type: 'color', input: '$tint' },
          },
        },
      },
      listeners: [{ on: 'click', emit: 'seen' }],
    });
    const p = player(raw);
    p.pointer('down', 10, 10);
    p.pointer('up', 10, 10);
    expect(p.step(0).events[0]?.payload).toEqual({ score: 4, label: 'Ada', color: '#11223344' });
    expect(
      runScript(p.model, 'advance 0\nsnapshot $score $label $tint').snapshots[0]!.values,
    ).toEqual({ $score: 4, $label: 'Ada', $tint: '#11223344' });
  });
});
it('uses string and enum equality in transition guards without coercing numbers', () => {
  const p = player(
    doc({
      machine: {
        layers: {
          m: {
            initial: 'idle',
            states: {
              idle: { pose: {}, on: [{ when: '$label == "Ada"', to: 'done' }] },
              done: { pose: { 'dot.x': 9 } },
            },
          },
        },
      },
    }),
  );
  p.step(0);
  expect(p.states()).toEqual({ m: 'done' });
});
it('delivers trigger data listeners once on the next step without storing a bool', () => {
  const p = player(doc({ listeners: [{ on: 'change:$pulse', set: { $score: '$score+1' } }] }));
  p.fire('$pulse');
  expect(p.step(0).settled).toBe(false);
  p.step(0);
  expect(p.get('$score')).toBe(5);
  p.step(0);
  expect(p.get('$score')).toBe(5);
});
it('keys number, string and enum custom properties with discrete string sampling', () => {
  const p = player(
    doc({
      requires: ['data', 'bind', 'motion'],
      nodes: [
        {
          id: 'dot',
          type: 'circle',
          center: [10, 10],
          r: 1,
          properties: {
            n: 0,
            label: 'start',
            mood: { type: 'enum', values: ['calm', 'happy'], default: 'calm' },
            pulse: { type: 'trigger' },
          },
        },
      ],
      timelines: {
        t: {
          duration: 1,
          tracks: {
            'dot.properties.n': [
              [0, 0],
              [1, 10],
            ],
            'dot.properties.label': [
              [0, 'start'],
              [1, 'end'],
            ],
            'dot.properties.mood': [
              [0, 'calm'],
              [1, 'happy'],
            ],
          },
        },
      },
      machine: { layers: { m: { initial: 'a', states: { a: { play: 't' } } } } },
    }),
  );
  p.step(0.5);
  expect(p.value('dot.properties.n')).toBe(5);
  expect(p.value('dot.properties.label')).toBe('start');
  p.step(0.5);
  expect(p.value('dot.properties.label')).toBe('end');
  expect(p.value('dot.properties.mood')).toBe('happy');
});
it('to-source publishes changes rather than overwriting unchanged targets every frame', () => {
  const p = player(
    doc({
      nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1, x: 1 }],
      bind: { 'dot.x': { value: '$score', mode: 'to-source' } },
    }),
  );
  p.step(0);
  expect(p.get('$score')).toBe(1);
  p.set('$score', 8);
  p.step(0);
  expect(p.get('$score')).toBe(8);
  expect(p.value('dot.x')).toBe(1);
});
it('defaults custom enums to their first member', () => {
  const p = player(
    doc({
      nodes: [
        {
          id: 'dot',
          type: 'circle',
          center: [10, 10],
          r: 1,
          properties: { mood: { type: 'enum', values: ['calm', 'happy'] } },
        },
      ],
    }),
  );
  p.step(0);
  expect(p.value('dot.properties.mood')).toBe('calm');
});
it('accepts zero-argument registered math functions', () => {
  registerFunction('testzero', 0, () => 7);
  expect(evaluate(expression('testzero()', new Map()), new Map())).toBe(7);
});
