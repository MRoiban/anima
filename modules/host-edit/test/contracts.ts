import type { Player } from '../../../packages/core/src/player.ts';
import type { HostData } from '../../host/core/api.ts';
export function repeatDocument() {
  return {
    anima: '0.1',
    name: 'repeat-edit',
    grid: 30,
    requires: ['components', 'data', 'bind', 'lists'],
    data: {
      models: {
        Board: { properties: { items: { type: 'list', of: 'Item' } } },
        Item: { properties: { n: { type: 'number' } } },
      },
      instances: {
        main: { model: 'Board', default: true, values: { items: [{ n: 3 }, { n: 7 }] } },
      },
    },
    components: {
      row: {
        grid: 10,
        data: 'Item',
        inputs: { go: { type: 'trigger' } },
        nodes: [{ id: 'dot', type: 'circle', center: [2, 2], r: 1 }],
        bind: { 'dot.r': '$n' },
        timelines: {
          grow: {
            duration: 1,
            tracks: {
              'dot.x': [
                [0, 0],
                [1, 8],
              ],
            },
          },
        },
        machine: {
          layers: {
            animation: {
              initial: 'idle',
              states: {
                idle: { pose: {}, on: [{ when: 'go', to: 'running' }] },
                running: { play: 'grow' },
              },
            },
          },
        },
      },
    },
    nodes: [{ id: 'rows', type: 'repeat', list: '$items', component: 'row', dy: 10 }],
  };
}
export function repeatContract(p: Player, api: HostData, children: () => Player[]) {
  api.bind('main');
  p.step(0);
  const [first, second] = children();
  p.fire('rows.0.go');
  p.step(0);
  p.step(0.25);
  const list = api.list('items');
  const snapshot = () => ({
    values: list.value,
    firstIndex: children().indexOf(first!),
    secondIndex: children().indexOf(second!),
    firstTime: first!.time,
    firstX: first!.value('dot.x'),
    firstState: first!.states().animation,
    radii: children().map((child) => child.value('dot.r')),
  });
  const result = [snapshot()];
  list.add({ n: 11 });
  p.step(0);
  result.push(snapshot());
  list.insert(0, { n: 2 });
  p.step(0);
  result.push(snapshot());
  list.swap(1, 2);
  p.step(0);
  result.push(snapshot());
  list.remove(1);
  p.step(0);
  result.push(snapshot());
  p.step(0.125);
  result.push(snapshot());
  return result;
}
export const repeatExpected = [
  {
    values: [{ n: 3 }, { n: 7 }],
    firstIndex: 0,
    secondIndex: 1,
    firstTime: 0.25,
    firstX: 2,
    firstState: 'running',
    radii: [3, 7],
  },
  {
    values: [{ n: 3 }, { n: 7 }, { n: 11 }],
    firstIndex: 0,
    secondIndex: 1,
    firstTime: 0.25,
    firstX: 2,
    firstState: 'running',
    radii: [3, 7, 11],
  },
  {
    values: [{ n: 2 }, { n: 3 }, { n: 7 }, { n: 11 }],
    firstIndex: 1,
    secondIndex: 2,
    firstTime: 0.25,
    firstX: 2,
    firstState: 'running',
    radii: [2, 3, 7, 11],
  },
  {
    values: [{ n: 2 }, { n: 7 }, { n: 3 }, { n: 11 }],
    firstIndex: 2,
    secondIndex: 1,
    firstTime: 0.25,
    firstX: 2,
    firstState: 'running',
    radii: [2, 7, 3, 11],
  },
  {
    values: [{ n: 2 }, { n: 3 }, { n: 11 }],
    firstIndex: 1,
    secondIndex: -1,
    firstTime: 0.25,
    firstX: 2,
    firstState: 'running',
    radii: [2, 3, 11],
  },
  {
    values: [{ n: 2 }, { n: 3 }, { n: 11 }],
    firstIndex: 1,
    secondIndex: -1,
    firstTime: 0.375,
    firstX: 3,
    firstState: 'running',
    radii: [2, 3, 11],
  },
];
