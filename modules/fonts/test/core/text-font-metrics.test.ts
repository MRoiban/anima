import { expect, it } from 'vitest';
import { decodeFont } from '../../core/info.ts';
import { testFont } from '../../../../tools/test-font.ts';
it('exposes decoded font-unit metrics, BMP/astral coverage and immutable effective options', () => {
  const f = decodeFont(testFont());
  expect(f.metrics).toMatchObject({
    unitsPerEm: 1000,
    ascent: 800,
    descent: 200,
    lineGap: 100,
    capHeight: 700,
    xHeight: 500,
  });
  expect(f.hasGlyph('A')).toBe(true);
  expect(f.hasGlyph(0x1f600)).toBe(true);
  expect(f.hasGlyph(0x10ffff)).toBe(false);
  expect(Object.isFrozen(f.metrics)).toBe(true);
  expect(Object.isFrozen(f.options.axes)).toBe(true);
});
it.each([
  ['font-format', new Uint8Array(4)],
  ['font-invalid', new Uint8Array([0, 1, 0, 0])],
])('reports structured %s decoding diagnostics', (code, bytes) => {
  expect(() => decodeFont(bytes)).toThrow(
    expect.objectContaining({
      code,
      pointer: '',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
