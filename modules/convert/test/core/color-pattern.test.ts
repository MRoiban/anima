import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { convertValue } from '../../core/index.ts';
import { load } from '../../../../packages/core/src/index.ts';
it.each([
  ['#ff000080', '255 0 0 128 0 100 50 #ff0000'],
  ['#00ff00', '0 255 0 255 120 100 50 #00ff00'],
  ['#0000ff', '0 0 255 255 240 100 50 #0000ff'],
  ['#ffffff', '255 255 255 255 0 0 100 #ffffff'],
  ['#000000', '0 0 0 255 0 0 0 #000000'],
  ['#808080', '128 128 128 255 0 0 50 #808080'],
])('formats independently calculated RGBA/HSL components of %s', (input, expected) => {
  expect(
    convertValue('color-format', input, { pattern: '{r} {g} {b} {a} {h} {s} {l} {hex}' }),
  ).toBe(expected);
});
it('reports unknown markers at the converter pattern with a hint', () => {
  const r = load({
    anima: '0.1',
    name: 'invalid',
    grid: 20,
    requires: ['convert'],
    nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
    converters: { fmt: { type: 'color-format', pattern: '{wat}' } },
  });
  expect(r.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'convert-options',
      pointer: '/converters/fmt/pattern',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
