import '../../../../packages/core/src/all.ts';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
it('R2-1: a cleared dynamic instance is not hit and does not throw', () => {
  const r = load({
    anima: '0.1',
    name: 'cleared-hit',
    grid: 20,
    requires: ['components', 'nested', 'data'],
    data: { models: { Main: { properties: { content: { type: 'component', default: 'a' } } } } },
    components: {
      a: {
        grid: 10,
        nodes: [{ id: 'r', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#000' } }],
      },
    },
    nodes: [{ id: 'slot', type: 'instance', component: '$content' }],
    listeners: [{ on: 'down', target: 'slot', emit: 'hit' }],
  });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  expect(p.hits(p.model.listeners[0]!, 1, 1)).toBe(true);
  p.set('$content', '');
  p.step(0);
  expect(p.hits(p.model.listeners[0]!, 1, 1)).toBe(false);
});
