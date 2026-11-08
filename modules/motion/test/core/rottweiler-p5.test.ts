import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';

// R2-07: a child's `$parent` keyframe value is unbound during construction; sampling waits for it.
it('constructs a component whose keyframe reads a $parent data path', () => {
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'parent-key',
    grid: 24,
    requires: ['data', 'motion', 'components', 'lists'],
    data: {
      models: { Root: { properties: { peak: { type: 'number', default: 8 } } } },
      model: 'Root',
    },
    components: {
      row: {
        grid: 24,
        nodes: [{ id: 'dot', type: 'circle', center: [1, 1], r: 1 }],
        timelines: {
          run: {
            duration: 1,
            tracks: {
              'dot.r': [
                [0, '$parent.peak'],
                [1, 10],
              ],
            },
          },
        },
        machine: { layers: { main: { initial: 'play', states: { play: { play: 'run' } } } } },
      },
    },
    nodes: [{ id: 'child', type: 'instance', component: 'row' }],
  });
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(model!);
  p.step(0);
  expect(p.values()['child/dot.r']).toBe(8);
});
