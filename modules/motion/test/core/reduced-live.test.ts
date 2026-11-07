import '@anima-format/core/all';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { expect, it } from 'vitest';
it('resumes a source-clocked loop after reducing it, with the motion policy installed', () => {
  const result = load({
    anima: '0.1',
    name: 'source-clock-reduce',
    grid: 20,
    requires: ['components', 'nested', 'motion', 'bind'],
    inputs: { clock: { type: 'number', default: 0.25 } },
    nodes: [{ id: 'badge', type: 'instance', component: 'row', time: 'clock' }],
    components: {
      row: {
        grid: 10,
        nodes: [{ id: 'dot', type: 'circle', center: [5, 5], r: 1, fill: { color: '#000' } }],
        timelines: {
          go: {
            duration: 1,
            loop: 'loop',
            tracks: {
              'dot.x': [
                [0, 0],
                [1, 10],
              ],
            },
          },
        },
        machine: { layers: { main: { initial: 'go', states: { go: { play: 'go' } } } } },
      },
    },
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(result.model!);
  p.step(0.25);
  expect(p.value('badge/dot.x')).toBeCloseTo(2.5);
  p.reducedMotion = true;
  p.step(0);
  expect(p.value('badge/dot.x')).toBe(10);
  p.reducedMotion = false;
  p.step(0);
  expect(p.value('badge/dot.x')).toBe(0);
  p.set('clock', 0.35);
  p.step(0);
  expect(p.value('badge/dot.x')).toBeCloseTo(1);
});
