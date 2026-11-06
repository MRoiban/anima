import '@anima-format/core/all';
import { it, expect } from 'vitest';
import { load, Player } from '../../../../packages/core/src/index.ts';
const raw = {
  anima: '0.1',
  name: 'input-data',
  grid: 20,
  requires: ['data', 'input', 'focus', 'bind'],
  data: {
    models: {
      Pad: {
        properties: {
          axis: { type: 'number' },
          pressed: { type: 'bool' },
          button: { type: 'number' },
          focused: { type: 'bool' },
        },
      },
    },
  },
  nodes: [
    { id: 'dot', type: 'circle', center: [10, 10], r: 8, fill: { color: '#000' }, focus: {} },
  ],
  listeners: [
    { on: 'gamepad-axis', control: 0, write: { value: '$axis' } },
    {
      on: 'gamepad-button',
      control: 0,
      phase: 'both',
      write: { pressed: '$pressed', value: '$button' },
    },
    { on: 'click', set: { $focused: true }, value: 'focused', target: 'dot' },
  ],
};
it('routes gamepad axis/button values into model fields through the input module', () => {
  const r = load(raw);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.input().gamepads([
    { index: 0, connected: true, axes: [0], buttons: [{ pressed: false, value: 0 }] },
  ]);
  p.step(0);
  p.input().gamepads([
    { index: 0, connected: true, axes: [0.5], buttons: [{ pressed: true, value: 0.75 }] },
  ]);
  p.step(0);
  expect(p.get('$axis')).toBe(0.5);
  expect(p.get('$button')).toBe(0.75);
  expect(p.get('$pressed')).toBe(true);
});
it('samples target focus at the time a queued listener action applies', () => {
  const r = load(raw);
  const p = new Player(r.model!);
  p.focusTarget('dot');
  p.pointer('down', 10, 10);
  p.pointer('up', 10, 10);
  p.step(0);
  expect(p.get('$focused')).toBe(true);
  p.pointer('down', 10, 10);
  p.pointer('up', 10, 10);
  p.focusClear();
  p.step(0);
  expect(p.get('$focused')).toBe(false);
});
