import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { drawFrame, load, runScript } from '@anima-format/core';
import { documentFonts } from '../../../../packages/cli/src/font/document.ts';
import { registerTextMeasurer } from '../../../text/core/measure.ts';
import type { FieldNode } from '../../core/index.ts';
for (const name of ['text-input-cursor', 'text-input-selection-rounding'])
  it(`original-font standalone drawing conformance: ${name}`, () => {
    const base = `spec/conformance/${name}/`,
      file = base + 'case.ani';
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    registerTextMeasurer(documentFonts(doc, file).measurer);
    const { model, diagnostics } = load(doc);
    expect(diagnostics).toEqual([]);
    const { player } = runScript(model!, readFileSync(base + 'script.txt', 'utf8'));
    const boxes = (drawFrame(player).nodes[0] as FieldNode).fieldBoxes!;
    const expected = JSON.parse(readFileSync(base + 'drawing.expected.json', 'utf8'));
    expect(boxes).toHaveLength(expected.length);
    for (const [i, box] of boxes.entries())
      for (const [key, value] of Object.entries(box)) {
        if (typeof value === 'number') expect(value, key).toBeCloseTo(expected[i][key], 10);
        else expect(value, key).toBe(expected[i][key]);
      }
  });
it('original-font placeholder conformance restores authored paint after clearing', () => {
  const base = 'spec/conformance/text-input-placeholder/';
  const doc = JSON.parse(readFileSync(base + 'case.ani', 'utf8'));
  registerTextMeasurer(documentFonts(doc, base + 'case.ani').measurer);
  const result = load(doc);
  expect(result.diagnostics).toEqual([]);
  const { player: p } = runScript(result.model!, readFileSync(base + 'script.txt', 'utf8'));
  const expected = JSON.parse(readFileSync(base + 'drawing.expected.json', 'utf8'));
  const text = () => (drawFrame(p).nodes[0] as FieldNode).text!;
  expect(text().runs[0]!.text).toBe(expected.placeholder);
  expect(text().paints).toEqual(expected.paints);
  expect(text().layout.lines[0]!.baseline).toBeCloseTo(expected.baseline, 10);
  p.set('$query', 'AB');
  p.step(0);
  expect(text().runs[0]!.text).toBe('AB');
  expect(text().paints[0]![0]!.color).toBe('#000');
  p.set('$query', '');
  p.step(0);
  expect(text().runs[0]!.text).toBe(expected.placeholder);
  expect(text().paints).toEqual(expected.paints);
});
