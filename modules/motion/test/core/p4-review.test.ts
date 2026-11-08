// Regression tests for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

it('R1-03: a zero exit threshold at zero speed carries zero, not NaN', () => {
  const r = load({
    anima: '0.1',
    name: 'p4',
    grid: 20,
    requires: ['motion'],
    nodes: [{ id: 'a', type: 'circle', center: [0, 0], r: 1, fill: { color: '#000' } }],
    inputs: { go: { type: 'bool', default: false } },
    timelines: {
      t: {
        duration: 1,
        tracks: {
          'a.y': [
            [0, 0],
            [1, 4],
          ],
        },
      },
      u: {
        duration: 1,
        tracks: {
          'a.x': [
            [0, 0],
            [1, 10],
          ],
        },
      },
    },
    machine: {
      layers: {
        l: {
          initial: 'hold',
          states: {
            hold: { play: 't', speed: 0, on: [{ when: 'go', to: 'run', exit: 0 }] },
            run: { play: 'u' },
          },
        },
      },
    },
  });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  p.set('go', true);
  p.step(0);
  expect(p.value('a.x')).toBe(0);
  p.step(0.5);
  expect(p.value('a.x')).toBeCloseTo(5);
});
