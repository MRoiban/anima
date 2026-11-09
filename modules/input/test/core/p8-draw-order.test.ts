import '../../../../packages/core/src/all.ts';
import { expect, it } from 'vitest';
import { load, Player, drawFrame } from '../../../../packages/core/src/index.ts';

const rect = (id: string, extra: object = {}) => ({
  id,
  type: 'rect',
  x0: 0,
  y0: 0,
  w: 10,
  h: 10,
  fill: { color: '#000' },
  ...extra,
});
function player(nodes: object[], listeners: object[] = [], extra: object = {}) {
  const result = load({
    anima: '0.1',
    name: 'paint-order',
    grid: 20,
    requires: ['input', 'focus', 'composite', 'bind', 'components'],
    inputs: { raised: { type: 'bool', default: true } },
    nodes,
    ...(nodes.some((n) => (n as { drawOrder?: object }).drawOrder)
      ? { bind: { 'a.drawOrder.active': 'raised' } }
      : {}),
    listeners,
    ...extra,
  });
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(result.model!);
}
const order = { target: 'b', position: 'after' };
const click = (p: Player) => {
  p.input().pointer('down', 5, 5);
  p.input().pointer('up', 5, 5);
  return p.step(0).events.map((e) => e.name);
};

it('R4-02: hit order swaps with resolved drawOrder.active before any draw', () => {
  const p = player(
    [rect('a', { drawOrder: order }), rect('b')],
    ['b', 'a'].map((target) => ({ on: 'click', target, consume: true, emit: target })),
  );
  p.step(0);
  expect(p.input().hitTest(5, 5)).toEqual(['a', 'b']);
  expect([...p.input().targets(5, 5)]).toEqual([0, 1]);
  expect(click(p)).toEqual(['a']);
  p.set('raised', false);
  p.step(0);
  expect(p.input().hitTest(5, 5)).toEqual(['b', 'a']);
  expect(click(p)).toEqual(['b']);
});

it('R4-02: opaque reordered subtrees retain their ancestor chain and choose the front blocker', () => {
  const p = player(
    [
      {
        id: 'a',
        type: 'group',
        drawOrder: order,
        children: [rect('cover', { opaque: true, cursor: 'pointer' })],
      },
      rect('b', { opaque: true, cursor: 'text' }),
    ],
    ['a', 'cover', 'b'].map((target) => ({ on: 'click', target, emit: target })),
  );
  p.step(0);
  expect(p.input().hitTest(5, 5)).toEqual(['cover', 'a']);
  expect(click(p)).toEqual(['cover', 'a']);
  expect(p.input().cursor).toBe('pointer');
  p.set('raised', false);
  p.step(0);
  expect(p.input().hitTest(5, 5)).toEqual(['b']);
  expect(click(p)).toEqual(['b']);
  expect(p.input().cursor).toBe('text');
});

it('R4-02: pointer focus follows subtree paint order, with and without input', () => {
  for (const input of [true, false]) {
    const p = player(
      [
        {
          id: 'a',
          type: 'group',
          drawOrder: order,
          children: [rect('inside', { focus: {} })],
        },
        rect('b', { focus: {} }),
      ],
      [],
      { requires: ['focus', 'composite', 'bind', ...(input ? ['input'] : [])] },
    );
    p.step(0);
    p.pointer('down', 5, 5);
    expect(p.focused).toBe('inside');
    p.set('raised', false);
    p.step(0);
    p.pointer('down', 5, 5);
    expect(p.focused).toBe('b');
  }
});

it('R4-02: nested focus ranks use the host paint rank then the child paint rank', () => {
  const p = player(
    [
      {
        id: 'a',
        type: 'instance',
        component: 'child',
        drawOrder: order,
      },
      rect('b', { focus: {} }),
    ],
    [],
    {
      components: {
        child: {
          grid: 20,
          nodes: [
            rect('first', { focus: {}, drawOrder: { target: 'last', position: 'after' } }),
            rect('last', { focus: {} }),
          ],
        },
      },
    },
  );
  p.step(0);
  p.pointer('down', 5, 5);
  expect(p.focused).toBe('a.first');
  p.set('raised', false);
  p.step(0);
  p.pointer('down', 5, 5);
  expect(p.focused).toBe('b');
});

it('R4-02: reordered opaque nodes block nested input and pointer focus', () => {
  const p = player(
    [
      rect('a', { opaque: true, drawOrder: order }),
      { id: 'b', type: 'instance', component: 'child' },
    ],
    [],
    {
      components: {
        child: {
          grid: 20,
          nodes: [rect('inside', { focus: {} })],
          listeners: [{ on: 'click', target: 'inside', emit: 'hit' }],
        },
      },
    },
  );
  p.step(0);
  expect(click(p)).toEqual([]);
  expect(p.focused).toBeNull();
  p.set('raised', false);
  p.step(0);
  expect(click(p)).toEqual(['b.hit']);
  expect(p.focused).toBe('b.inside');
});

it('R4-02: paintRank is per player, cached by revision, and absent without drawOrder', () => {
  const plain = player([rect('a')]);
  expect(plain.paintRank).toBeUndefined();
  const p = player([
    {
      id: 'a',
      type: 'group',
      drawOrder: order,
      children: [rect('inside')],
    },
    rect('b'),
  ]);
  const other = new Player(p.model);
  p.step(0);
  other.set('raised', false);
  other.step(0);
  expect(p.model.nodes.map((_, i) => p.paintRank?.(i))).toEqual([1, 2, 0]);
  expect(other.model.nodes.map((_, i) => other.paintRank?.(i))).toEqual([0, 1, 2]);
  const frame = drawFrame(p);
  expect(frame.order![0]).toBeGreaterThan(frame.order![2]!);
  p.set('raised', false);
  p.step(0);
  expect(p.paintRank?.(0)).toBeLessThan(p.paintRank?.(2) ?? -1);
});
