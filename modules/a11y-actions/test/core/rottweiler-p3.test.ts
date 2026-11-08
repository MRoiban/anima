import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player } from '@anima-format/core';

// Rottweiler P3 R1-05: a semantically hidden group removes focus-only descendants from focus.
it('excludes focus-only descendants of a semantically hidden subtree', () => {
  const circle = (id: string, extra: object = {}) => ({
    id,
    type: 'circle',
    center: [2, 2],
    r: 1,
    fill: { color: '#000' },
    ...extra,
  });
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'hidden-focus',
    grid: 20,
    requires: ['a11y', 'focus'],
    inputs: { hidden: { type: 'bool', default: false } },
    nodes: [
      {
        id: 'parent',
        type: 'group',
        a11y: { role: 'group', hidden: 'hidden' },
        children: [circle('focusOnly', { focus: { tabStops: true } })],
      },
      circle('outside', { a11y: { role: 'button', label: 'Outside' } }),
    ],
  });
  expect(diagnostics).toEqual([]);
  const p = new Player(model!);
  expect(p.focusItems().map((n) => n.id)).toEqual(['focusOnly', 'outside']);
  p.set('hidden', true);
  p.step(0);
  expect(p.focusItems().map((n) => n.id)).toEqual(['outside']);
  expect(p.focusItems(true).map((n) => n.id)).toEqual(['focusOnly', 'outside']);
  expect(p.focusTarget('focusOnly')).toBe(false);
  p.set('hidden', false);
  p.step(0);
  expect(p.focusItems().map((n) => n.id)).toEqual(['focusOnly', 'outside']);
});
