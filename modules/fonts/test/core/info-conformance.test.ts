import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { decodeFont } from '../../core/info.ts';
for (const name of ['text-font-metrics', 'text-font-decoding'])
  it('independent font API vectors: ' + name, () => {
    const expected = JSON.parse(
      readFileSync('spec/conformance/' + name + '/api.expected.json', 'utf8'),
    );
    const f = decodeFont(readFileSync('fixtures/fonts/anima-test.ttf')).derive({
      axes: expected.axes,
    });
    expect(f.metrics).toEqual(expected.metrics);
    expect(f.options).toEqual({ axes: expected.axes, features: expected.features });
    expect([f.hasGlyph('A'), f.hasGlyph(0x1f600), f.hasGlyph(0x10ffff)]).toEqual(expected.coverage);
    expect(f.glyphs('A')[0]!.path).toBe(expected.pathA);
  });
