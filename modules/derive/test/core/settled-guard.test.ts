import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';

export const scene = {
  anima: '0.1',
  name: 'settled-guard',
  grid: 20,
  requires: ['data', 'bind', 'derive'],
  nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
  data: {
    models: {
      Kit: {
        properties: {
          status: { type: 'number' },
          hasStatus: { type: 'bool', value: '$status > 0' },
        },
      },
    },
    instances: { kit: { model: 'Kit', default: true } },
  },
  machine: {
    layers: {
      status: {
        initial: 'none',
        states: {
          none: { pose: { 'dot.r': 1 }, on: [{ when: '$kit:hasStatus == true', to: 'on' }] },
          on: { pose: { 'dot.r': 3 }, on: [{ when: '$kit:hasStatus == false', to: 'none' }] },
        },
      },
    },
  },
};
it('B12 a single write on a settled player resolves derived guards in the same step', () => {
  const result = load(scene);
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(result.model!);
  expect(p.step(0).settled).toBe(true);
  p.set('$kit:status', 2);
  expect(p.step(0).settled).toBe(true);
  expect(p.get('$kit:hasStatus')).toBe(true);
  expect(p.states()).toEqual({ status: 'on' });
  expect(p.value('dot.r')).toBe(3);
  p.set('$kit:status', 0);
  p.step(0);
  expect(p.get('$kit:hasStatus')).toBe(false);
  expect(p.states()).toEqual({ status: 'none' });
});
