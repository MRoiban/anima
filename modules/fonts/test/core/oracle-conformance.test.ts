import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { documentFonts } from '../../../../packages/cli/src/font/document.ts';
import { registerTextMeasurer } from '../../../text/core/measure.ts';
import { textLayout } from '../../../text/core/index.ts';

// The resource projection is deterministic. FontFace decoding/replacement/fallback themselves
// remain browser tests; snapshots never pretend that Node decodes a platform font object.
for (const name of [
  'assets-font',
  'assets-host-decode-font',
  'assets-replacement-scope-font',
  'data-host-font',
  'host-api-data-font',
  'host-api-font-fallback',
  'text-font-fallback',
  'text-font-assets',
])
  it(`generated-font resource conformance: ${name}`, () => {
    const file = `spec/conformance/${name}/case.ani`;
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    const fonts = documentFonts(doc, file);
    expect(fonts.diagnostics).toEqual([]);
    registerTextMeasurer(fonts.measurer);
    const result = load(doc);
    expect(result.diagnostics).toEqual([]);
    const p = new Player(result.model!);
    const expected = JSON.parse(
      readFileSync(`spec/conformance/${name}/layout.expected.json`, 'utf8'),
    );
    // 4 glyphs × 600/1000 × size 2; explicit 1-em leading and 800/1000 ascent.
    for (const face of ['body', 'alternate']) {
      p.set('$face', face);
      p.step(0);
      const layout = textLayout(p, 0);
      expect(layout.width).toBeCloseTo(expected.width, 10);
      expect(layout.height).toBe(expected.height);
      expect(layout.lines.map((line) => line.baseline)).toEqual(expected.baselines);
      expect(layout.lines.map((line) => line.clusters.map((c) => c.text).join(''))).toEqual(
        expected.strings,
      );
      expect(layout.lines[0]!.clusters[0]!.font.family).toBe(face);
    }
  });
