import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { drawFrame, load, Player } from '@anima-format/core';

const make = (nodes: object[], extra: object = {}) => {
  const result = load({
    anima: '0.1',
    name: 'pathfollow-runtime',
    grid: 30,
    requires: ['rig', 'pathfollow'],
    nodes,
    ...extra,
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
};

const world = (p: Player, id: string) => {
  const values = p.values();
  return [values[id + '.world.x'], values[id + '.world.y'], values[id + '.world.rotate']];
};

it('places and orients along an open transformed path', () => {
  const p = make([
    { id: 'track', type: 'path', d: 'M0 0L10 0', x: 5, rotate: 90 },
    {
      id: 'dot',
      type: 'group',
      constraints: [{ kind: 'alongPath', path: 'track', at: 0.25, orient: true }],
    },
  ]);
  expect(world(p, 'dot')[0]).toBeCloseTo(5, 12);
  expect(world(p, 'dot')[1]).toBeCloseTo(2.5, 12);
  expect(world(p, 'dot')[2]).toBeCloseTo(90, 12);
});

it('wraps closed circles and clamps open paths', () => {
  const closed = make([
    { id: 'track', type: 'circle', center: [10, 10], r: 4 },
    {
      id: 'dot',
      type: 'group',
      constraints: [{ kind: 'alongPath', path: 'track', at: 1.25 }],
    },
  ]);
  expect(world(closed, 'dot').slice(0, 2)).toEqual([10, 14]);
  const open = make([
    { id: 'track', type: 'path', d: 'M0 0L8 0' },
    {
      id: 'dot',
      type: 'group',
      constraints: [{ kind: 'alongPath', path: 'track', at: 2 }],
    },
  ]);
  expect(world(open, 'dot').slice(0, 2)).toEqual([8, 0]);
});

it('adds the node translation away from rest when offset is enabled', () => {
  const p = make(
    [
      { id: 'track', type: 'path', d: 'M0 0L10 0' },
      {
        id: 'dot',
        type: 'group',
        x: 2,
        constraints: [{ kind: 'alongPath', path: 'track', at: 0.5, offset: true }],
      },
    ],
    {
      timelines: {
        move: {
          duration: 1,
          tracks: {
            'dot.x': [
              [0, 2],
              [1, 4],
            ],
          },
        },
      },
      machine: { layers: { main: { initial: 'move', states: { move: { play: 'move' } } } } },
    },
  );
  p.step(1);
  expect(world(p, 'dot').slice(0, 2)).toEqual([7, 0]);
});

it('spreads direct children over start/end/shift fractions', () => {
  const p = make([
    { id: 'track', type: 'path', d: 'M0 0L20 0' },
    {
      id: 'beads',
      type: 'group',
      constraints: [{ kind: 'spreadAlongPath', path: 'track', start: 0.1, end: 0.7, shift: 0.1 }],
      children: [
        { id: 'a', type: 'group' },
        { id: 'b', type: 'group' },
        { id: 'c', type: 'group' },
      ],
    },
  ]);
  expect(world(p, 'a')[0]).toBeCloseTo(4, 12);
  expect(world(p, 'b')[0]).toBeCloseTo(10, 12);
  expect(world(p, 'c')[0]).toBeCloseTo(16, 12);
});

it('spreads reconciled repeat items at 1, 3 and 5 positions', () => {
  const p = make(
    [
      { id: 'track', type: 'path', d: 'M0 0L20 0' },
      {
        id: 'rows',
        type: 'repeat',
        count: '$n',
        component: 'bead',
        constraints: [{ kind: 'spreadAlongPath', path: 'track' }],
      },
    ],
    {
      requires: ['rig', 'pathfollow', 'components', 'data', 'bind', 'lists'],
      data: {
        models: { Board: { properties: { n: { type: 'number', default: 1 } } } },
        instances: { main: { model: 'Board', default: true, values: {} } },
      },
      components: {
        bead: { grid: 10, nodes: [{ id: 'dot', type: 'rect', x0: 0, y0: 0, w: 1, h: 1 }] },
      },
    },
  );
  const positions = () => {
    const frame = drawFrame(p);
    return frame.tree.nodes
      .map((node, index) => [node.id, frame.nodes[index]?.world?.[4]] as const)
      .filter(([id]) => typeof id === 'string' && /^rows\/\d+$/.test(id))
      .map(([, x]) => x);
  };
  expect(positions()).toEqual([0]);
  p.set('$n', 3);
  p.step(0);
  expect(positions()).toEqual([0, 10, 20]);
  p.set('$n', 5);
  p.step(0);
  expect(positions()).toEqual([0, 5, 10, 15, 20]);
});
