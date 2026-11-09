// Regression tests for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

const rects = [
  { id: 'a', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#000' }, focus: {} },
  { id: 'b', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#000' }, focus: {} },
];
const focused = (doc: object) => {
  const r = load({ anima: '0.1', name: 'p4', grid: 20, ...doc });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.focusPointer(5, 5);
  return p.focused;
};

it('R3-07: pointer focus picks the frontmost overlapping node inside a component', () => {
  expect(focused({ requires: ['focus'], nodes: rects })).toBe('b');
  expect(
    focused({
      requires: ['components', 'focus'],
      components: { child: { grid: 20, nodes: rects } },
      nodes: [{ id: 'c', type: 'instance', component: 'child' }],
    }),
  ).toBe('c.b');
});
