import '@anima-format/core/all';
import { expect } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
export function document() {
  return {
    anima: '0.1',
    name: 'nested-host',
    grid: 20,
    requires: ['data', 'bind', 'datahost'],
    data: {
      models: {
        Root: {
          properties: {
            team: { type: 'model-ref', model: 'Team' },
            a: { type: 'number', default: 3 },
            b: { type: 'number', default: 4 },
          },
        },
        Team: { properties: { lead: { type: 'model-ref', model: 'Person' } } },
        Person: {
          properties: {
            name: { type: 'string', default: 'Ada' },
            tint: { type: 'color', default: '#123456' },
          },
        },
      },
      instances: {
        main: { model: 'Root', default: true, exported: true },
        private: { model: 'Root' },
      },
    },
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    bind: { 'dot.r': { value: '$a' } },
  };
}
export function create(doc: object) {
  const r = load(doc);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
}
