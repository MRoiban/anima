import '../../../../packages/core/src/all.ts';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
function make(nodes: unknown[], extras: object = {}) {
  const r = load({
    anima: '0.1',
    name: 'semantics-layout',
    grid: 100,
    requires: ['layout', 'a11y'],
    nodes,
    ...extras,
  });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  return p;
}
const child = {
  id: 'tile',
  type: 'rect',
  x0: 0,
  y0: 0,
  w: 2,
  h: 2,
  layout: { width: 'fill', height: 'fill' },
  fill: { color: '#000' },
  a11y: { role: 'button' },
};
it('R1-5: semantic bounds use the normalized drawing transform', () => {
  const p = make([
    {
      id: 'root',
      type: 'layout',
      children: [
        {
          id: 'dot',
          type: 'circle',
          center: [50, 50],
          r: 5,
          fill: { color: '#000' },
          a11y: { role: 'button' },
        },
      ],
    },
  ]);
  expect(p.semantics()[0]!.bounds).toEqual([0, 0, 10, 10]);
});
it('R1-4: semantic cache invalidates on layoutSize and each reflow frame', () => {
  const p = make([
    { id: 'root', type: 'layout', width: 20, height: 10, reflow: 1, children: [child] },
  ]);
  expect(p.semantics()[0]!.bounds).toEqual([0, 0, 20, 10]);
  p.layoutSize = [40, 20];
  p.step(0);
  p.step(0.5);
  expect(p.semantics()[0]!.bounds).toEqual([0, 0, 30, 15]);
  p.step(0.5);
  expect(p.semantics()[0]!.bounds).toEqual([0, 0, 40, 20]);
});
it('R1-4: semantic cache tracks revisions of collected child players', () => {
  const p = make([{ id: 'slot', type: 'instance', component: 'card' }], {
    requires: ['layout', 'a11y', 'components'],
    components: {
      card: {
        grid: 20,
        nodes: [{ id: 'root', type: 'layout', width: 20, height: 10, children: [child] }],
      },
    },
  });
  expect(p.semantics()[0]!.bounds).toEqual([0, 0, 20, 10]);
  const nested = p.nested as typeof p.nested & { players: Map<string, Player> };
  const c = nested!.players.get('slot')!;
  c.layoutSize = [40, 20];
  c.step(0);
  expect(p.semantics()[0]!.bounds).toEqual([0, 0, 40, 20]);
});
