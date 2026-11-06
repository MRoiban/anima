import '@anima-format/core/all';
import { expect } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
export function document() {
  return {
    anima: '0.1',
    name: 'edit',
    grid: 20,
    requires: ['data'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    data: {
      models: {
        Board: {
          properties: {
            tint: { type: 'color', default: '#12345678' },
            mood: { type: 'enum', values: ['calm', 'happy'] },
            items: { type: 'list', of: 'Item' },
            mixed: { type: 'list' },
            team: { type: 'model-ref', model: 'Item' },
            score: { type: 'number' },
          },
        },
        Item: { properties: { count: { type: 'number', default: 3 } } },
      },
      instances: {
        main: { model: 'Board', default: true, values: { items: [{ count: 5 }, 'named'] } },
        other: { model: 'Board', values: { score: 8 } },
        named: { model: 'Item', values: { count: 7 } },
      },
    },
    bind: { 'dot.r': { value: '$score' } },
  };
}
export function player(doc: object = document()) {
  const result = load(doc);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(result.model!);
  p.data.bind('main');
  return p;
}
