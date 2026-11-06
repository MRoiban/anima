import '../../../../packages/core/src/all.ts';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { load, Player, runScript, drawFrame } from '../../../../packages/core/src/index.ts';
import { inputCommand } from '../../core/commands.ts';
import { inputMatrix } from '../../web/mapping.ts';
const circle = { id: 'disc', type: 'circle', center: [10, 10], r: 5, fill: { color: '#000' } };
export function document(
  listeners: Record<string, unknown>[] = [],
  extra: Record<string, unknown> = {},
) {
  return {
    anima: '0.1',
    name: 'test',
    grid: 20,
    requires: ['input'],
    nodes: [circle],
    inputs: {
      x: { type: 'number' },
      y: { type: 'number' },
      dx: { type: 'number' },
      dy: { type: 'number' },
      a: { type: 'bool' },
      b: { type: 'bool' },
      n: { type: 'number' },
      pressed: { type: 'bool' },
    },
    listeners,
    ...extra,
  };
}
function player(listeners: Record<string, unknown>[] = [], extra: Record<string, unknown> = {}) {
  const r = load(document(listeners, extra));
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
}
const commit = (p: Player) => p.step(0);
describe('input contacts and actions', () => {
  it('keeps legacy bell traces byte-equivalent with the input module registered', () => {
    const r = load(readFileSync(new URL('../../../../examples/bell.ani', import.meta.url), 'utf8'));
    expect(r.diagnostics).toEqual([]);
    const p = new Player(r.model!);
    expect(() => p.input()).toThrow('requires input');
    p.pointer('move', 10, 10);
    commit(p);
    expect(p.get('hover')).toBe(true);
    p.pointer('down', 10, 10);
    commit(p);
    expect(p.get('down')).toBe(true);
    p.pointer('leave');
    commit(p);
    expect(p.get('hover')).toBe(false);
    expect(p.get('down')).toBe(false);
    const run = runScript(r.model!, 'pointer click 10 10\nsnapshot');
    expect(run.snapshots[0]!.states.ring).toBe('ringing');
  });
  it.each([0, 1, 2])('filters button %i including click and drag', (button) => {
    const p = player([{ on: 'down|click|drag', button, set: { a: true } }]),
      c = p.input();
    c.pointer('down', 10, 10, { button: (button + 1) % 3 });
    commit(p);
    expect(p.get('a')).toBe(false);
    c.pointer('cancel');
    c.pointer('down', 10, 10, { button });
    commit(p);
    expect(p.get('a')).toBe(true);
    p.set('a', false);
    commit(p);
    c.pointer('move', 20, 20, { button });
    commit(p);
    expect(p.get('a')).toBe(true);
  });
  it('isolates two contacts, cancels at last known coordinates, and suppresses click after drag', () => {
    const p = player([
        { on: 'down', write: { pointerId: 'n' } },
        { on: 'drag', write: { dx: 'dx', dy: 'dy' } },
        { on: 'cancel', write: { x: 'x', y: 'y' }, set: { a: true } },
        { on: 'click', set: { b: true } },
      ]),
      c = p.input();
    c.pointer('down', 8, 8, { id: 7 });
    c.pointer('down', 12, 12, { id: 8 });
    commit(p);
    expect(p.get('n')).toBe(8);
    c.pointer('move', 30, 25, { id: 7 });
    commit(p);
    expect([p.get('dx'), p.get('dy')]).toEqual([22, 17]);
    c.pointer('cancel', 0, 0, { id: 7 });
    commit(p);
    expect([p.get('x'), p.get('y')]).toEqual([30, 25]);
    expect(c.contacts.has(8)).toBe(true);
    c.pointer('up', 12, 12, { id: 8 });
    commit(p);
    expect(p.get('b')).toBe(true);
  });
  it('starts drag once at the threshold, continues outside bounds, and ends once', () => {
    const p = player([
        { on: 'drag-start', emit: 'start' },
        { on: 'drag', emit: 'drag' },
        { on: 'drag-end', emit: 'end' },
        { on: 'click', emit: 'click' },
      ]),
      c = p.input(),
      names: string[] = [];
    const step = () => names.push(...p.step(0).events.map((e) => e.name));
    c.pointer('down', 10, 10);
    step();
    c.pointer('move', 10.49, 10);
    step();
    expect(names).toEqual([]);
    c.pointer('move', 10.5, 10);
    step();
    c.pointer('move', 30, 10);
    step();
    c.pointer('up', 30, 10);
    step();
    c.pointer('up', 30, 10);
    step();
    expect(names).toEqual(['start', 'drag', 'drag', 'end']);
  });
  it('enables identifiers independently and clears a disabled press', () => {
    const p = player([
        { on: 'down', set: { a: true } },
        { on: 'click', set: { b: true } },
      ]),
      c = p.input();
    c.enablePointer(9, false);
    c.pointer('down', 10, 10, { id: 9 });
    commit(p);
    expect(p.get('a')).toBe(false);
    c.enablePointer(9, true);
    c.pointer('down', 10, 10, { id: 9 });
    c.enablePointer(9, false);
    c.enablePointer(9, true);
    c.pointer('up', 10, 10, { id: 9 });
    commit(p);
    expect(p.get('b')).toBe(false);
  });
  it('runs capture outer to inner before bubbling, stopping when consumed', () => {
    const p = player(
      [
        { on: 'down', target: 'disc', emit: 'target' },
        { on: 'down', target: 'group', capture: true, emit: 'outer' },
        { on: 'down', target: 'disc', capture: true, consume: true, emit: 'inner' },
      ],
      { nodes: [{ id: 'group', type: 'group', children: [circle] }] },
    );
    p.input().pointer('down', 10, 10);
    expect(commit(p).events.map((e) => e.name)).toEqual(['outer', 'inner']);
  });
  it.each(['snap', 'preserve'])('aligns %s in transformed parent coordinates', (align) => {
    const p = player([{ on: 'drag', target: 'disc', align, write: { x: 'x', y: 'y' } }], {
        nodes: [
          { id: 'group', type: 'group', x: 4, scale: 2, children: [{ ...circle, x: 3, y: 1 }] },
        ],
      }),
      c = p.input();
    c.pointer('down', 30, 22);
    c.pointer('move', 34, 28);
    commit(p);
    expect([p.get('x'), p.get('y')]).toEqual(align === 'snap' ? [15, 14] : [5, 4]);
  });
  it('queues drag values for bindings without changing the pointer API step contract', () => {
    const p = player([{ on: 'drag', write: { dx: 'x' } }], {
      requires: ['input', 'bind'],
      bind: { 'disc.x': 'x' },
    });
    p.input().pointer('down', 10, 10);
    p.input().pointer('move', 15, 10);
    expect(p.get('x')).toBe(0);
    commit(p);
    expect(p.value('disc.x')).toBe(5);
  });
});
describe('hit policy and collapse', () => {
  it('uses transformed shape geometry, not just a bounding rectangle', () => {
    const p = player([{ on: 'down', target: 'disc', set: { a: true } }]);
    expect(p.input().hitTest(14.5, 14.5)).toEqual([]);
    expect(p.input().hitTest(10, 10)).toEqual(['disc']);
  });
  it('tests groups, parent visibility and pointer enablement', () => {
    const nodes = [{ id: 'group', type: 'group', pointerEnabled: false, children: [circle] }];
    const p = player([{ on: 'down', target: 'disc', set: { a: true } }], { nodes });
    expect(p.input().hitTest(10, 10)).toEqual([]);
    const q = player([{ on: 'down', target: 'group', set: { a: true } }], {
      nodes: [{ id: 'group', type: 'group', children: [circle] }],
    });
    expect(q.input().hitTest(10, 10)).toEqual(['group']);
  });
  it('bounds queries by the declared viewBox', () => {
    const p = player([{ on: 'down', target: 'disc', set: { a: true } }], {
      nodes: [{ ...circle, center: [23, 10] }],
    });
    expect(p.input().hitTest(23, 10)).toEqual(['disc']);
    expect(p.input().hitTest(23, 10, { bounded: true })).toEqual([]);
  });
  it('opaque hit targets suppress lower siblings while preserving ancestors', () => {
    const p = player(
      [
        { on: 'down', target: 'disc', emit: 'low' },
        { on: 'down', target: 'top', emit: 'top' },
        { on: 'down', emit: 'icon' },
      ],
      { nodes: [circle, { ...circle, id: 'top', opaque: true }] },
    );
    expect(p.input().occludes(10, 10)).toBe(true);
    p.input().pointer('down', 10, 10);
    expect(commit(p).events.map((e) => e.name)).toEqual(['top', 'icon']);
  });
  it('resolves cursor intent from the foremost hit target', () => {
    const p = player([{ on: 'enter', target: 'disc', set: { a: true } }], {
      nodes: [{ ...circle, cursor: 'resize-horizontal' }],
    });
    p.input().pointer('move', 10, 10);
    expect(p.input().cursor).toBe('resize-horizontal');
    p.input().pointer('leave');
    expect(p.input().cursor).toBeUndefined();
  });
  it('collapses inactive solo branches in both drawing and hit testing', () => {
    const p = player(
      [
        { on: 'down', target: 'disc', set: { a: true } },
        { on: 'down', target: 'other', set: { b: true } },
      ],
      {
        nodes: [
          { id: 'group', type: 'group', solo: 1, children: [circle, { ...circle, id: 'other' }] },
        ],
      },
    );
    const frame = drawFrame(p);
    expect(frame.nodes.map((n) => n.visible)).toEqual([true, false, true]);
    expect(p.input().hitTest(10, 10)).toEqual(['other']);
  });
  it('recomputes descendant draw visibility after an animated solo selection', () => {
    const p = player([], {
      nodes: [
        { id: 'group', type: 'group', solo: 0, children: [circle, { ...circle, id: 'other' }] },
      ],
      requires: ['input', 'bind'],
      inputs: { n: { type: 'number' } },
      bind: { 'group.solo': 'n' },
    });
    commit(p);
    expect(drawFrame(p).nodes.map((n) => n.visible)).toEqual([true, true, false]);
    p.set('n', 1);
    commit(p);
    expect(drawFrame(p).nodes.map((n) => n.visible)).toEqual([true, false, true]);
  });
});
describe('keyboard, scroll, gamepad', () => {
  it.each(['key-down', 'key-repeat', 'key-up'])(
    'selects %s with exact modifier matching and wildcard keys',
    (event) => {
      const p = player([{ on: event, key: '*', modifiers: 'shift+control', set: { a: true } }]),
        c = p.input();
      const kind = event === 'key-up' ? 'up' : 'down',
        repeat = event === 'key-repeat';
      c.key(kind, 'F13', { repeat, shift: true, control: true, alt: true });
      commit(p);
      expect(p.get('a')).toBe(false);
      c.key(kind, 'F13', { repeat, shift: true, control: true });
      commit(p);
      expect(p.get('a')).toBe(true);
    },
  );
  it('bubbles keys through the selected target ancestors and consumes them', () => {
    const p = player(
      [
        { on: 'key-down', key: 'ArrowLeft', target: 'disc', consume: true, emit: 'child' },
        { on: 'key-down', target: 'group', emit: 'parent' },
      ],
      { nodes: [{ id: 'group', type: 'group', children: [circle] }] },
    );
    p.input().key('down', 'ArrowLeft', { target: 'disc' });
    expect(commit(p).events.map((e) => e.name)).toEqual(['child']);
  });
  it('latches scroll targets, expires at 150 ms and cancels explicitly', () => {
    const p = player([{ on: 'scroll', target: 'disc', write: { deltaX: 'x', deltaY: 'y' } }]),
      c = p.input();
    expect(c.wantsScroll(0, 0)).toBe(false);
    expect(c.scroll(10, 10, 1.25, 2.5, { time: 0 })).toBe(true);
    commit(p);
    expect(p.get('y')).toBe(2.5);
    expect(c.scroll(50, 50, 4, 5, { time: 0.1 })).toBe(true);
    commit(p);
    expect(p.get('x')).toBe(4);
    expect(c.scroll(50, 50, 6, 7, { time: 0.251 })).toBe(false);
    c.scroll(10, 10, 1, 2, { phase: 'start', time: 1 });
    c.cancelScroll();
    expect(c.wantsScroll(50, 50)).toBe(false);
  });
  it('uses exact continuous deltas and explicit scroll end/cancel phases', () => {
    const p = player([{ on: 'scroll', target: 'disc', write: { deltaY: 'y' } }]),
      c = p.input();
    c.scroll(10, 10, 0, 0.0625, { phase: 'start' });
    commit(p);
    expect(p.get('y')).toBe(0.0625);
    c.scroll(40, 40, 0, 1, { phase: 'end' });
    expect(c.wantsScroll(40, 40)).toBe(false);
    c.scroll(10, 10, 0, 2);
    c.scroll(0, 0, 0, 0, { phase: 'cancel' });
    expect(c.wantsScroll(40, 40)).toBe(false);
  });
  it('routes connected, changed axis/button and disconnected records by index/mapping', () => {
    const p = player([
        { on: 'gamepad-connected', index: 2, emit: 'connect' },
        { on: 'gamepad-axis', index: 2, control: 1, mapping: 'standard', write: { value: 'x' } },
        { on: 'gamepad-button', control: 0, write: { pressed: 'pressed', value: 'y' } },
        { on: 'gamepad-disconnected', emit: 'disconnect' },
      ]),
      c = p.input();
    c.gamepads([
      {
        index: 2,
        connected: true,
        mapping: 'standard',
        axes: [0, -0.25],
        buttons: [{ value: 0.75, pressed: true }],
      },
    ]);
    expect(commit(p).events.map((e) => e.name)).toEqual(['connect']);
    expect([p.get('x'), p.get('y'), p.get('pressed')]).toEqual([-0.25, 0.75, true]);
    c.gamepads([{ index: 2, connected: false }]);
    expect(commit(p).events.map((e) => e.name)).toEqual(['disconnect']);
    expect(c.pads.size).toBe(0);
  });
  it.each(['press', 'release', 'both'])('filters gamepad button phase %s', (phase) => {
    const p = player([{ on: 'gamepad-button', phase, emit: 'button' }]),
      c = p.input(),
      counts: number[] = [];
    for (const pressed of [true, true, false]) {
      c.gamepads([{ index: 0, connected: true, buttons: [{ value: pressed ? 1 : 0, pressed }] }]);
      counts.push(commit(p).events.length);
    }
    expect(counts).toEqual(
      phase === 'press' ? [1, 0, 0] : phase === 'release' ? [0, 0, 1] : [1, 0, 1],
    );
  });
  it('validates a whole gamepad batch atomically and copies caller-owned arrays', () => {
    const p = player([{ on: 'gamepad-connected', emit: 'connected' }]),
      c = p.input();
    expect(() =>
      c.gamepads([
        { index: 0, connected: true },
        { index: 1, connected: true, axes: [2] },
      ]),
    ).toThrow();
    expect(c.pads.size).toBe(0);
    expect(commit(p).events).toEqual([]);
    const axes = [0.5];
    c.gamepads([{ index: 0, connected: true, axes }]);
    axes[0] = 1;
    expect(c.pads.get(0)!.axes).toEqual([0.5]);
  });
});
describe('input diagnostics and tooling seam', () => {
  it.each([
    [
      { on: 'key-down', modifiers: 'meta+shift', set: { a: true } },
      'input-modifiers',
      '/listeners/0/modifiers',
    ],
    [{ on: 'down', button: 0.5, set: { a: true } }, 'input-index', '/listeners/0/button'],
    [{ on: 'down', button: 3, set: { a: true } }, 'input-index', '/listeners/0/button'],
    [{ on: 'drag', write: { bad: 'x' } }, 'input-write', '/listeners/0/write/bad'],
    [{ on: 'drag', write: { x: 'a' } }, 'input-write', '/listeners/0/write/x'],
  ] as const)('reports %s', (listener, code, pointer) => {
    const r = load(document([listener]));
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer,
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
    expect(r.model).toBeUndefined();
  });
  it('gates new events and properties by requires without gating old listeners', () => {
    expect(
      load(document([{ on: 'down', set: { a: true } }], { requires: [] })).model,
    ).toBeDefined();
    expect(
      load(document([{ on: 'key-down', set: { a: true } }], { requires: [] })).diagnostics,
    ).toContainEqual(
      expect.objectContaining({ code: 'undeclared-feature', pointer: '/listeners/0/on' }),
    );
    expect(
      load(document([], { requires: [], nodes: [{ ...circle, opaque: true }] })).diagnostics,
    ).toContainEqual(
      expect.objectContaining({ code: 'undeclared-feature', pointer: '/nodes/0/opaque' }),
    );
  });
  it('validates solo direct-child indices with a corrective diagnostic', () => {
    const r = load(
      document([], { nodes: [{ id: 'g', type: 'group', solo: 1, children: [circle] }] }),
    );
    expect(r.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'input-solo',
        pointer: '/nodes/0/solo',
        hint: expect.any(String),
      }),
    );
  });
  it('implements standalone command handlers ready for anima sample integration', () => {
    const p = player([
      { on: 'drag', write: { dx: 'x' } },
      { on: 'key-down', set: { a: true } },
      { on: 'scroll', write: { deltaY: 'y' } },
    ]);
    inputCommand(p, 'contact', ['down', '7', '10', '10']);
    inputCommand(p, 'contact', ['move', '7', '20', '10']);
    commit(p);
    expect(p.get('x')).toBe(10);
    inputCommand(p, 'key', ['down', 'Enter']);
    commit(p);
    expect(p.get('a')).toBe(true);
    inputCommand(p, 'scroll', ['10', '10', '0', '2.5', 'start', '0']);
    commit(p);
    expect(p.get('y')).toBe(2.5);
    expect(inputCommand(p, 'snapshot', [])).toBe(false);
    expect(() => inputCommand(p, 'contact', ['down', '7'])).toThrow();
  });
  it.each(['contain', 'cover', 'fill', 'none'])(
    'computes finite fit/alignment matrices for %s',
    (fit) => {
      const m = inputMatrix([-2, -2, 24, 24], 100, 80, fit, 'top-left');
      expect(m.every(Number.isFinite)).toBe(true);
      expect(m[4]).toBeCloseTo(2 * m[0]);
      expect(m[5]).toBeCloseTo(2 * m[3]);
    },
  );
});

it('forwards concurrent IDs through scaled component instances and cancels collapsed branches', () => {
  const p = player([], {
    requires: ['components', 'input'],
    components: {
      badge: {
        grid: 20,
        nodes: [circle],
        inputs: { dx: { type: 'number' } },
        listeners: [{ on: 'drag', target: 'disc', write: { dx: 'dx' } }],
      },
    },
    nodes: [{ id: 'badge', type: 'instance', component: 'badge', x: 4, scale: 2 }],
  });
  const c = p.input();
  c.pointer('down', 24, 20, { id: 7 });
  c.pointer('down', 22, 18, { id: 8 });
  c.pointer('move', 32, 20, { id: 7 });
  commit(p);
  expect(p.get('badge.dx')).toBe(4);
  const children = (p.nested as unknown as { players: Map<string, Player> }).players;
  expect([...children.get('badge')!.input().contacts.keys()]).toEqual([7, 8]);
  c.pointer('cancel', 0, 0, { id: 7 });
  expect([...children.get('badge')!.input().contacts.keys()]).toEqual([8]);
});
it('lets opaque nodes without actions block lower interaction, and cursor-only nodes request a cursor', () => {
  const p = player([{ on: 'down', target: 'disc', set: { a: true } }], {
    nodes: [circle, { ...circle, id: 'top', opaque: true, cursor: 'text' }],
  });
  p.input().pointer('down', 10, 10);
  commit(p);
  expect(p.get('a')).toBe(false);
  expect(p.input().cursor).toBe('text');
});
it('does not hit an inactive solo descendant through a group target', () => {
  const p = player([{ on: 'down', target: 'group', set: { a: true } }], {
    nodes: [
      {
        id: 'group',
        type: 'group',
        solo: 1,
        children: [circle, { ...circle, id: 'far', center: [40, 40] }],
      },
    ],
  });
  expect(p.input().hitTest(10, 10)).toEqual([]);
});

it('composes scene event kinds without accepting unknown dotted component events', () => {
  for (const on of ['focus', 'blur', 'key-down', 'down|key-down', 'gamepad-axis']) {
    const r = load(
      document([{ on, set: { n: 1 } }], { requires: ['components', 'focus', 'input'] }),
    );
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  }
  const r = load(
    document([{ on: 'missing.output', set: { n: 1 } }], {
      requires: ['components', 'focus', 'input'],
    }),
  );
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'unknown-event',
      pointer: '/listeners/0/on',
      hint: expect.any(String),
    }),
  );
});

it('applies input pointer hit gating to focus without suppressing keyboard focus', () => {
  const p = player([{ on: 'down', target: 'disc', set: { a: true } }], {
    requires: ['input', 'focus'],
    nodes: [{ ...circle, focus: {}, pointerEnabled: false }],
  });
  p.input().pointer('down', 10, 10);
  expect(p.focused).toBeNull();
  expect(p.focusTarget('disc')).toBe(true);
  const q = player([{ on: 'down', target: 'disc', set: { a: true } }], {
    requires: ['input', 'focus'],
    nodes: [
      { ...circle, focus: {} },
      { ...circle, id: 'top', opaque: true },
    ],
  });
  q.input().pointer('down', 10, 10);
  expect(q.focused).toBeNull();
});
