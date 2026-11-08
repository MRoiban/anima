import '../../../../packages/core/src/all.ts';
import { expect, it } from 'vitest';
import { load, Player, drawFrame } from '../../../../packages/core/src/index.ts';
const rect = { id: 'tile', type: 'rect', x0: 10, y0: 10, w: 2, h: 2, fill: { color: '#000' } };
function make(nodes: unknown[], extra: object = {}) {
  const r = load({
    anima: '0.1',
    name: 'review',
    grid: 100,
    requires: ['layout'],
    nodes,
    ...extra,
  });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  return p;
}
it('R1-2: rect hits and pointer actions follow allocated geometry', () => {
  const p = make(
    [
      {
        id: 'root',
        type: 'layout',
        width: 50,
        height: 20,
        children: [{ ...rect, layout: { width: 'fill', height: 'fill' } }],
      },
    ],
    {
      inputs: { down: { type: 'bool' } },
      listeners: [{ on: 'down', target: 'tile', set: { down: true } }],
    },
  );
  expect(drawFrame(p).nodes[1]!.geometry).toMatchObject({ x: 0, y: 0, width: 50, height: 20 });
  expect(p.hits(p.model.listeners[0]!, 25, 10)).toBe(true);
  expect(p.hits(p.model.listeners[0]!, 51, 10)).toBe(false);
  p.pointer('down', 25, 10);
  p.step(0);
  expect(p.get('down')).toBe(true);
});
it('R1-2: normalized shape hits follow the drawing, including ancestor transforms', () => {
  const p = make(
    [
      {
        id: 'group',
        type: 'group',
        x: 3,
        y: 4,
        scale: 2,
        children: [
          {
            id: 'root',
            type: 'layout',
            children: [
              { id: 'dot', type: 'circle', center: [50, 50], r: 5, fill: { color: '#000' } },
            ],
          },
        ],
      },
    ],
    {
      listeners: [{ on: 'down', target: 'dot', emit: 'hit' }],
    },
  );
  expect(p.hits(p.model.listeners[0]!, 13, 14)).toBe(true);
  expect(p.hits(p.model.listeners[0]!, 103, 104)).toBe(false);
});
it('R1-3: hug measures the selected dynamic child and remeasures swaps and clear', () => {
  const p = make(
    [
      {
        id: 'root',
        type: 'layout',
        children: [{ id: 'slot', type: 'instance', component: '$content' }],
      },
    ],
    {
      requires: ['layout', 'components', 'nested', 'data'],
      data: { models: { Main: { properties: { content: { type: 'component', default: 'a' } } } } },
      components: {
        a: { grid: 20, viewBox: [0, 0, 7, 8], nodes: [rect] },
        b: { grid: 30, nodes: [rect] },
      },
    },
  );
  expect(p.layoutBox('slot')).toMatchObject({ width: 7, height: 8 });
  p.set('$content', 'b');
  p.step(0);
  expect(p.layoutBox('slot')).toMatchObject({ width: 30, height: 30 });
  p.set('$content', '');
  p.step(0);
  expect(p.layoutBox('slot')).toMatchObject({ width: 0, height: 0 });
});
it('R1-2: nested instance hits and child pointer coordinates use the drawn allocation', () => {
  const p = make(
    [
      {
        id: 'root',
        type: 'layout',
        width: 50,
        height: 20,
        children: [
          {
            id: 'slot',
            type: 'instance',
            component: 'card',
            layout: { width: 'fill', height: 'fill' },
          },
        ],
      },
    ],
    {
      requires: ['layout', 'components', 'input'],
      components: {
        card: {
          grid: 10,
          inputs: { down: { type: 'bool' } },
          nodes: [
            { id: 'button', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#000' } },
          ],
          listeners: [{ on: 'down', target: 'button', set: { down: true } }],
        },
      },
      listeners: [{ on: 'down', target: 'slot', emit: 'slot' }],
    },
  );
  expect(p.hits(p.model.listeners[0]!, 25, 10)).toBe(true);
  p.input().pointer('down', 25, 10);
  p.step(0);
  expect(p.get('slot.down')).toBe(true);
});

it('R1-2: allocated image viewports override the assets module authored outline', () => {
  const p = make(
    [
      {
        id: 'root',
        type: 'layout',
        width: 50,
        height: 20,
        children: [
          {
            id: 'pic',
            type: 'image',
            asset: 'pic',
            x0: 10,
            y0: 10,
            width: 2,
            height: 2,
            layout: { width: 'fill', height: 'fill' },
          },
        ],
      },
    ],
    {
      requires: ['layout', 'assets', 'paint'],
      assets: { pic: { type: 'image', source: 'data:image/png;base64,AA==' } },
      listeners: [{ on: 'down', target: 'pic', emit: 'hit' }],
    },
  );
  expect(p.hits(p.model.listeners[0]!, 25, 10)).toBe(true);
  expect(p.hits(p.model.listeners[0]!, 51, 10)).toBe(false);
});
