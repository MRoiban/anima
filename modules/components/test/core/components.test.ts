import '../../../../packages/core/src/all.ts';
import { describe, it, expect } from 'vitest';
import { load, Player, drawFrame, toSVG } from '../../../../packages/core/src/index.ts';

const badge = () => ({
  grid: 8,
  inputs: {
    count: { type: 'number', default: 1, min: 0, max: 8 },
    pop: { type: 'trigger' },
    active: { type: 'bool' },
  },
  nodes: [{ id: 'dot', type: 'circle', center: [4, 4], r: 1, fill: { color: '#f00' } }],
  bind: { 'dot.r': 'count' },
  listeners: [{ on: 'click', fire: 'pop' }],
  machine: {
    layers: {
      main: {
        initial: 'idle',
        states: {
          idle: { pose: {}, on: [{ when: 'pop', to: 'popped' }] },
          popped: { pose: { 'dot.opacity': 0.5 }, emit: 'clicked' },
        },
      },
    },
  },
});
const doc = () => ({
  anima: '0.1',
  name: 'components-test',
  grid: 20,
  requires: ['components', 'bind'],
  components: { badge: badge() },
  inputs: { unread: { type: 'number', default: 3 }, seen: { type: 'bool' } },
  nodes: [
    {
      id: 'b1',
      type: 'instance',
      component: 'badge',
      x: 10,
      scale: 2,
      inputs: { count: '{unread}' },
    },
    { id: 'b2', type: 'instance', component: 'badge', inputs: { count: 2 } },
  ],
  listeners: [{ on: 'b1.clicked', set: { seen: true } }],
});
function player(d: object = doc()) {
  const r = load(d);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
}

describe('components', () => {
  it('runs independent players with parent input expressions, scoped values, states and draw ids', () => {
    const p = player();
    p.step(0);
    expect(p.values()).toMatchObject({
      'b1/count': 3,
      'b1/dot.r': 3,
      'b2/count': 2,
      'b2/dot.r': 2,
    });
    expect(p.states()).toEqual({ 'b1/main': 'idle', 'b2/main': 'idle' });
    expect(
      drawFrame(p)
        .tree.nodes.map((n) => n.id)
        .filter(Boolean),
    ).toEqual(['b1/dot', 'b2/dot']);
    expect(toSVG(p)).toContain('id="ab1/dot"');
    p.set('unread', 5);
    p.step(0);
    expect(p.value('b1/dot.r')).toBe(5);
    expect(p.inspect().map((i) => i.layer)).toEqual(['b1/main', 'b2/main']);
  });
  it('routes transformed pointer coordinates, bubbles events and queues parent listener/transition actions', () => {
    const d = doc();
    Object.assign(d, {
      machine: {
        layers: {
          parent: {
            initial: 'waiting',
            states: {
              waiting: { pose: {}, on: [{ when: 'b1.clicked', to: 'done' }] },
              done: { pose: {} },
            },
          },
        },
      },
    });
    const p = player(d);
    p.step(0);
    p.pointer('down', 18, 8);
    p.pointer('up', 18, 8);
    const r = p.step(0);
    expect(r.events.map((e) => e.name)).toEqual(['b1.clicked']);
    expect(r.settled).toBe(false);
    expect(p.states()['b1/main']).toBe('popped');
    expect(p.states()['b2/main']).toBe('idle');
    expect(p.get('seen')).toBe(false);
    expect(p.step(0).settled).toBe(true);
    expect(p.get('seen')).toBe(true);
    expect(p.states().parent).toBe('done');
  });
  it('writes instance inputs from listeners, host fire/set/toggle, and explicit bindings', () => {
    const d = doc();
    d.nodes[0]!.inputs = { count: 1 as never };
    d.listeners = [
      { on: 'click', set: { 'b1.count': 6 }, fire: 'b1.pop', toggle: 'b1.active' } as never,
    ];
    const p = player(d);
    p.pointer('down', 1, 1);
    p.pointer('up', 1, 1);
    p.step(0);
    expect(p.get('b1.count')).toBe(6);
    expect(p.get('b1.active')).toBe(true);
    expect(p.states()['b1/main']).toBe('popped');
    const b = doc();
    Object.assign(b, { bind: { 'b1.count': 'unread * 2' } });
    const q = player(b);
    q.step(0);
    expect(q.value('b1/dot.r')).toBe(6);
    q.set('unread', 99);
    q.step(0);
    expect(q.value('b1/dot.r')).toBe(8);
  });
  it('steps nested players with speed, pauses clocks and skips invisible settled instances', () => {
    const b = badge();
    Object.assign(b, {
      timelines: {
        grow: {
          duration: 1,
          tracks: {
            'dot.x': [
              [0, 0],
              [1, 10],
            ],
          },
        },
      },
      machine: { layers: { main: { initial: 'grow', states: { grow: { play: 'grow' } } } } },
    });
    const d = doc();
    d.components.badge = b;
    d.listeners = [];
    Object.assign(d.nodes[0]!, { speed: 2 });
    Object.assign(d.nodes[1]!, { paused: true });
    const p = player(d);
    p.step(0.25);
    expect(p.value('b1/dot.x')).toBe(5);
    expect(p.value('b2/dot.x')).toBe(0);
    p.step(0.25);
    expect(p.value('b1/dot.x')).toBe(10);
    const hidden = doc();
    Object.assign(hidden.nodes[0]!, { visible: false });
    const h = player(hidden);
    h.step(0);
    const rev = h.drawVersions[0];
    h.step(1);
    expect(h.drawVersions[0]).toBe(rev);
    const nested = doc();
    Object.assign(nested.components, {
      wrapper: { grid: 8, nodes: [{ id: 'inside', type: 'instance', component: 'badge' }] },
    });
    nested.listeners = [];
    nested.nodes = [{ id: 'outer', type: 'instance', component: 'wrapper' } as never];
    const n = player(nested);
    n.step(0);
    expect(n.states()['outer/inside/main']).toBe('idle');
    expect(n.value('outer/inside/dot.r')).toBe(1);
  });
  it.each([
    [
      'unknown-component',
      '/nodes/0/component',
      (d: ReturnType<typeof doc>) => {
        d.nodes[0]!.component = 'absent';
      },
    ],
    [
      'unknown-input',
      '/nodes/0/inputs/missing',
      (d: ReturnType<typeof doc>) => {
        d.nodes[0]!.inputs = { missing: 1 } as never;
      },
    ],
    [
      'input-type',
      '/nodes/0/inputs/count',
      (d: ReturnType<typeof doc>) => {
        d.nodes[0]!.inputs = { count: true } as never;
      },
    ],
    [
      'bind-type',
      '/nodes/0/inputs/count',
      (d: ReturnType<typeof doc>) => {
        d.nodes[0]!.inputs = { count: '{mix(#fff,#000,unread)}' };
      },
    ],
    [
      'bind-syntax',
      '/nodes/0/inputs/count',
      (d: ReturnType<typeof doc>) => {
        d.nodes[0]!.inputs = { count: 'unread' };
      },
    ],
    [
      'unknown-input',
      '/nodes/0/inputs/count',
      (d: ReturnType<typeof doc>) => {
        d.nodes[0]!.inputs = { count: '{absent}' };
      },
    ],
    [
      'unknown-event',
      '/listeners/0/on',
      (d: ReturnType<typeof doc>) => {
        d.listeners[0]!.on = 'b1.absent';
      },
    ],
    [
      'component-event-collision',
      '/nodes/0',
      (d: ReturnType<typeof doc>) => {
        d.components.badge.listeners = [{ on: 'click', emit: 'pop' } as never];
      },
    ],
  ])('diagnostic %s at %s', (code, pointer, change) => {
    const d = doc();
    change(d);
    expect(load(d).diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer,
        severity: 'error',
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
  it('rejects direct and indirect recursion, depth >8 and expanded count >256 without throwing', () => {
    for (const indirect of [false, true]) {
      const d = doc();
      Object.assign(d.components, {
        badge: {
          grid: 8,
          nodes: [{ id: 'recursive', type: 'instance', component: indirect ? 'other' : 'badge' }],
        },
        other: { grid: 8, nodes: [{ id: 'cycle', type: 'instance', component: 'badge' }] },
      });
      expect(load(d).diagnostics.some((d) => d.code === 'component-cycle')).toBe(true);
    }
    const d = doc();
    d.nodes = Array.from(
      { length: 257 },
      (_, i) => ({ id: 'i' + i, type: 'instance', component: 'badge' }) as never,
    );
    expect(load(d).diagnostics.some((d) => d.code === 'limit-exceeded')).toBe(true);
    const deep = doc();
    for (let i = 0; i < 9; i++)
      Object.assign(deep.components, {
        ['c' + i]: {
          grid: 8,
          nodes: [{ id: 'child', type: 'instance', component: i === 8 ? 'badge' : 'c' + (i + 1) }],
        },
      });
    expect(load(deep).diagnostics.some((d) => d.code === 'limit-exceeded')).toBe(true);
  });
});

it('keeps nested paint/composite resources, local source transforms and sibling ranks scoped', () => {
  const d = {
    anima: '0.1',
    name: 'composite-components',
    grid: 20,
    requires: ['components', 'paint', 'composite'],
    components: {
      tile: {
        grid: 8,
        nodes: [
          { id: 'cut', type: 'rect', x0: 0, y0: 0, w: 4, h: 8, fill: { color: '#fff' } },
          {
            id: 'first',
            type: 'circle',
            center: [4, 4],
            r: 3,
            fill: {
              type: 'linear',
              x1: 0,
              y1: 0,
              x2: 8,
              y2: 0,
              stops: [
                { position: 0, color: '#f00' },
                { position: 1, color: '#00f' },
              ],
            },
            clip: { source: 'cut' },
            drawOrder: { target: 'last', position: 'after' },
          },
          { id: 'last', type: 'circle', center: [4, 4], r: 1, fill: { color: '#0f0' } },
        ],
      },
    },
    nodes: [
      { id: 'left', type: 'instance', component: 'tile', x: 2 },
      { id: 'right', type: 'instance', component: 'tile', x: 10 },
    ],
  };
  const p = player(d);
  p.step(0);
  const f = drawFrame(p);
  const left = f.tree.nodes.findIndex((n) => n.id === 'left/first'),
    right = f.tree.nodes.findIndex((n) => n.id === 'right/first');
  expect(f.nodes[left]!.clip!.source).not.toBe(f.nodes[right]!.clip!.source);
  expect(f.nodes[left]!.world![4]).toBe(2);
  expect(f.nodes[right]!.world![4]).toBe(10);
  expect(f.order![left]).toBeGreaterThan(f.order![left + 1]!);
  expect(f.order![right]).toBeGreaterThan(f.order![right + 1]!);
  const svg = toSVG(p);
  expect(svg).toContain('linearGradient');
  expect(svg).toContain('clipPath');
  expect(svg.indexOf('id="aleft/last"')).toBeLessThan(svg.indexOf('id="aleft/first"'));
});

it('reserves every instance registry property at the component input declaration', async () => {
  const { nodeShape } = await import('../../../../packages/core/src/registry.ts');
  const shape = nodeShape(
    'instance' as import('../../../../packages/core/src/registry.ts').NodeType,
  );
  expect(Object.keys(shape.p)).toEqual(
    expect.arrayContaining(['x', 'component', 'inputs', 'blend', 'mask', 'clip']),
  );
  for (const name of Object.keys(shape.p)) {
    const d = {
      anima: '0.1',
      name: 'reserved-input',
      grid: 20,
      requires: ['components'],
      components: {
        badge: {
          grid: 8,
          inputs: { [name]: { type: 'number' } },
          nodes: [{ id: 'dot', type: 'circle', center: [4, 4], r: 2, fill: { color: '#f00' } }],
        },
      },
      nodes: [{ id: 'b', type: 'instance', component: 'badge' }],
    };
    expect(load(d).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'reserved-input-name',
        pointer: '/components/badge/inputs/' + name,
        hint: `rename the input; ${name} is an instance property (e.g. use pos-x)`,
      }),
    );
  }
});
