import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, runScript } from '@anima-format/core';
import { compile } from '@anima-format/markup';
import { readFileSync } from 'node:fs';
import { semanticDiff } from '../../../a11y-actions/core/diff.ts';
const root = new URL('../../../../', import.meta.url);
it('[P3b-9] exposes filtered inspection as a subtree and reports an unknown id', () => {
  const model = load(
    readFileSync(new URL('spec/conformance/a11y-focus-policy/case.ani', root), 'utf8'),
  ).model!;
  const r = runScript(model, 'advance 0\nsemantics parent\nsemantics child');
  expect(r.snapshots).toEqual([]);
  expect(r.output).toHaveLength(2);
  expect(r.output[0]).toMatchObject({ id: 'parent', children: [{ id: 'child' }] });
  expect(r.output[1]).toMatchObject({ id: 'child', children: [] });
  expect(() => runScript(model, 'semantics missing')).toThrow('unknown semantic id');
});
it('[P3b-9] diffs additions, removals, property changes and sibling reorder without descendant noise', () => {
  const n = (id: string, label = id) => ({
    id,
    role: 'text',
    label,
    states: {},
    bounds: [0, 0, 1, 1] as [number, number, number, number],
    actions: [],
    children: [],
  });
  const parent = { ...n('p'), children: [n('a'), n('b'), n('gone')] };
  const next = { ...parent, children: [n('b', 'Changed'), n('new'), n('a')] };
  expect(semanticDiff([parent], [next])).toEqual({
    added: ['new'],
    removed: ['gone'],
    changed: [
      { id: 'p', keys: ['children'] },
      { id: 'b', keys: ['label'] },
    ],
  });
});
it('[P3b-9] ancestor machine conditions read the same focused ancestry as the semantic tree', () => {
  const text = readFileSync(new URL('spec/conformance/a11y-focus-policy/case.ani', root), 'utf8');
  const p = new Player(load(text).model!);
  p.semanticAction('child', 'focus');
  p.step(0);
  expect(p.machineFocus?.('parent')).toBe(true);
  expect(p.machineFocus?.('child')).toBe(true);
  expect(p.machineFocus?.('other')).toBe(false);
  p.focusClear();
  p.step(0);
  expect(p.machineFocus?.('parent')).toBe(false);
});
it('[P3b-9] changes a heading level through a constrained numeric input in both spellings', () => {
  const result = compile(
    '<anima version="0.1" name="level" grid="20" requires="a11y"><number name="depth" default="2" min="1" max="6"/><group id="h"><a11y role="heading" level="&quot;depth&quot;"/></group></anima>',
  );
  expect(result.diagnostics).toEqual([]);
  const p = new Player(load(result.doc!).model!);
  expect(p.semantics()[0]!.level).toBe(2);
  p.set('depth', 4);
  p.step(0);
  expect(p.semantics()[0]!.level).toBe(4);
});
it('[P3b-9] filters hidden/disabled/modal semantic targets on the first focus read and after input changes', () => {
  const p = new Player(
    load({
      anima: '0.1',
      name: 'restrictions',
      grid: 20,
      requires: ['a11y', 'focus'],
      inputs: { modal: { type: 'bool' } },
      nodes: [
        { id: 'hidden', type: 'group', a11y: { role: 'button', hidden: true } },
        { id: 'disabled', type: 'group', a11y: { role: 'button', disabled: true } },
        { id: 'live', type: 'group', a11y: { role: 'button' } },
        {
          id: 'dialog',
          type: 'group',
          a11y: { role: 'dialog', modal: 'modal' },
          children: [{ id: 'inside', type: 'group', a11y: { role: 'button' } }],
        },
      ],
    }).model!,
  );
  expect(p.focusItems().map((n) => n.id)).toEqual(['live', 'inside']);
  expect(p.focusTarget('hidden')).toBe(false);
  expect(p.focusTarget('disabled')).toBe(false);
  p.set('modal', true);
  p.step(0);
  expect(p.focusItems().map((n) => n.id)).toEqual(['inside']);
  expect(p.focusTarget('live')).toBe(false);
  expect(p.focusTraverse('next')).toBe(true);
  expect(p.focused).toBe('inside');
  expect(p.focusItems(true).map((n) => n.id)).toContain('hidden');
});
