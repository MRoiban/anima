import { describe, it, expect } from 'vitest';
import { load, Player, registerModule } from '../../../../packages/core/src/index.ts';
import { focus } from '../../core/index.ts';
import { compile } from '../../../../packages/markup/src/index.ts';
registerModule(focus);
export const doc = {
  anima: '0.1',
  name: 'focus-test',
  grid: 20,
  requires: ['focus'],
  inputs: { enabled: { type: 'bool', default: true }, seen: { type: 'number', default: 0 } },
  nodes: [
    {
      id: 'scope',
      type: 'group',
      focus: { enabled: false, scope: true, edge: 'stop' },
      children: [
        {
          id: 'a',
          type: 'circle',
          center: [2, 2],
          r: 1,
          fill: { color: '#000' },
          focus: { bounds: [1, 1, 2, 2] },
        },
        {
          id: 'b',
          type: 'circle',
          center: [8, 2],
          r: 1,
          fill: { color: '#000' },
          focus: { bounds: [7, 1, 2, 2], enabledInput: 'enabled' },
        },
        {
          id: 'c',
          type: 'circle',
          center: [2, 8],
          r: 1,
          fill: { color: '#000' },
          focus: { bounds: [1, 7, 2, 2] },
        },
      ],
    },
    {
      id: 'outside',
      type: 'circle',
      center: [15, 2],
      r: 1,
      fill: { color: '#000' },
      focus: { bounds: [14, 1, 2, 2] },
    },
  ],
  listeners: [
    { on: 'focus', target: 'a', set: { seen: 1 } },
    { on: 'blur', target: 'a', set: { seen: 2 } },
  ],
};
function player(edge = 'stop') {
  const raw = structuredClone(doc);
  raw.nodes[0]!.focus.edge = edge;
  const r = load(raw);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return new Player(r.model!);
}
describe('focus deterministic traversal', () => {
  it('targets, clears and rejects missing targets', () => {
    const p = player();
    expect(p.focused).toBe(null);
    expect(p.focusTarget('a')).toBe(true);
    expect(p.focusTarget('missing')).toBe(false);
    expect(p.focused).toBe('a');
    p.focusClear();
    expect(p.focused).toBe(null);
  });
  it('sequential next/previous respects authored order', () => {
    const p = player();
    p.focusTraverse();
    expect(p.focused).toBe('a');
    p.focusTraverse('next');
    expect(p.focused).toBe('b');
    p.focusTraverse('previous');
    expect(p.focused).toBe('a');
  });
  it.each([
    ['right', 'a', 'b'],
    ['left', 'b', 'a'],
    ['down', 'a', 'c'],
    ['up', 'c', 'a'],
  ] as const)('%s uses world-space centers', (d, a, b) => {
    const p = player();
    p.focusTarget(a);
    p.focusTraverse(d);
    expect(p.focused).toBe(b);
  });
  it('stop retains focus at scope edge', () => {
    const p = player();
    p.focusTarget('c');
    expect(p.focusTraverse()).toBe(false);
    expect(p.focused).toBe('c');
  });
  it('closed-loop wraps only within scope', () => {
    const p = player('closed-loop');
    p.focusTarget('c');
    p.focusTraverse();
    expect(p.focused).toBe('a');
    p.focusTraverse('previous');
    expect(p.focused).toBe('c');
    p.focusTarget('b');
    p.focusTraverse('right');
    expect(p.focused).toBe('a');
  });
  it('parent-scope escapes to outer candidates', () => {
    const p = player('parent-scope');
    p.focusTarget('c');
    p.focusTraverse();
    expect(p.focused).toBe('outside');
  });
  it('enabled input removes nodes and clears invalid focus', () => {
    const p = player();
    p.focusTarget('b');
    p.set('enabled', false);
    p.step(0);
    expect(p.focused).toBe(null);
    p.focusTarget('a');
    p.focusTraverse();
    expect(p.focused).toBe('c');
  });
  it('pointer down focuses the highest painted eligible target', () => {
    const p = player();
    p.pointer('down', 8, 2);
    expect(p.focused).toBe('b');
    p.pointer('up', 2, 2);
    expect(p.focused).toBe('b');
  });
  it('listeners queue blur then focus writes for step', () => {
    const p = player();
    p.focusTarget('a');
    expect(p.get('seen')).toBe(0);
    p.step(0);
    expect(p.get('seen')).toBe(1);
    p.focusTarget('b');
    p.step(0);
    expect(p.get('seen')).toBe(2);
  });
  it('ties use authored node order and invisible ancestors exclude descendants', () => {
    const raw = structuredClone(doc);
    Object.assign(raw.nodes[0]!, { visible: false });
    const p = new Player(load(raw).model!);
    expect(p.focusItems().map((n) => n.id)).toEqual(['outside']);
  });
  it('validates bool input references with code, pointer, message and hint', () => {
    const raw = structuredClone(doc);
    raw.nodes[0]!.children![1]!.focus.enabledInput = 'missing';
    expect(load(raw).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'unknown-input',
        pointer: '/nodes/0/children/1/focus/enabledInput',
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
  it('requires focus for focus/blur listeners', () => {
    const raw = structuredClone(doc);
    raw.requires = [];
    expect(load(raw).diagnostics.some((d) => d.code === 'undeclared-feature')).toBe(true);
  });
  it('registry exposes AniML node focus and document tab stops', () => {
    const r = compile(
      '<anima version="0.1" name="focus" grid="20" requires="focus"><circle id="a" cx="2" cy="2" r="1" fill="#000"><focus tab-stops="true" label="A" bounds="1 1 2 2"/></circle><listener on="focus" target="a" emit="selected"/></anima>',
    );
    expect(r.diagnostics).toEqual([]);
    expect(JSON.parse(r.text!).nodes[0].focus.label).toBe('A');
  });
});

it('targets component-local nodes, traverses their scope and routes child focus listeners', () => {
  const { anima: _anima, name: _name, requires: _requires, ...child } = structuredClone(doc);
  void _anima;
  void _name;
  void _requires;
  const raw = {
    anima: '0.1',
    name: 'nested-focus',
    grid: 20,
    requires: ['components', 'focus'],
    components: { child },
    nodes: [
      { id: 'one', type: 'instance', component: 'child', x: 2 },
      { id: 'two', type: 'instance', component: 'child', x: 10 },
    ],
  };
  const r = load(raw);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  expect(p.focusTarget('one.a')).toBe(true);
  p.step(0);
  expect(p.get('one.seen')).toBe(1);
  p.focusTraverse('right');
  expect(p.focused).toBe('one.b');
  p.step(0);
  expect(p.get('one.seen')).toBe(2);
  p.focusTarget('two.a');
  expect(p.focused).toBe('two.a');
});
