import '../../../../packages/core/src/all.ts';
import { expect, it } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
it('R1-1: guards a declining layout nesting factory', () => {
  const r = load({
    anima: '0.1',
    name: 'empty-nesting',
    grid: 20,
    requires: ['layout', 'components', 'nested'],
    nodes: [{ id: 'tile', type: 'rect', x0: 0, y0: 0, w: 2, h: 2, fill: { color: '#000' } }],
  });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  expect(new Player(r.model!).nested).toBeUndefined();
});
