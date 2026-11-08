import '@anima-format/core/all';
import { load, Player } from '@anima-format/core';
import { beforeEach, expect, it } from 'vitest';
import { measureText, registerTextMeasurer, textLayout, textRun } from '../../core/index.ts';
import { fixedMeasurer } from './measurer.ts';

beforeEach(() => registerTextMeasurer(fixedMeasurer));
function player(extra: Record<string, unknown> = {}) {
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'layout-measure',
    grid: 20,
    requires: ['text'],
    nodes: [
      {
        id: 'label',
        type: 'text',
        runs: [{ id: 'value', text: 'abcdef', style: 's' }],
        styles: { s: { size: 2 } },
        wordBreak: 'break-all',
        ...extra,
      },
      { id: 'shape', type: 'circle', center: [0, 0], r: 1, fill: { color: '#000' } },
    ],
  });
  expect(diagnostics).toEqual([]);
  const p = new Player(model!);
  p.step(0);
  return p;
}
it('exposes measured box and first baseline in local grid units', () => {
  const p = player();
  expect(measureText(p, 'label')).toEqual({ width: 12, height: 2, baseline: 1.6 });
  expect(measureText(p, 0)).toEqual(measureText(p, 'label'));
  expect(measureText(p, 'missing')).toBeUndefined();
  expect(measureText(p, 'shape')).toBeUndefined();
});
it('remeasures with a width constraint without replacing the drawing layout or authored input', () => {
  const p = player();
  const before = textLayout(p, 0);
  expect(measureText(p, 'label', 4)).toEqual({ width: 4, height: 6, baseline: 1.6 });
  expect(textLayout(p, 0)).toBe(before);
  expect(p.model.nodes[0]!.raw.width).toBeUndefined();
  expect(measureText(p, 'label')).toEqual({ width: 12, height: 2, baseline: 1.6 });
});
it('uses current player values and a replacement registered measurer', () => {
  const p = player();
  textRun(p, 'label', 'value', 'abc');
  p.step(0);
  expect(measureText(p, 'label')).toEqual({ width: 6, height: 2, baseline: 1.6 });
  registerTextMeasurer({
    measure(font, source) {
      const measured = fixedMeasurer.measure(font, source);
      measured.advances = measured.advances.map((n) => n * 2);
      return measured;
    },
  });
  expect(measureText(p, 'label')).toEqual({ width: 12, height: 2, baseline: 1.6 });
});
it('retains fixed height, trim, fit, origin and an empty visible baseline from shared layout', () => {
  const p = player({ width: 8, height: 2, overflow: 'fit', wrap: false, origin: 'baseline' });
  const layout = textLayout(p, 0);
  expect(measureText(p, 'label', 4)).toEqual({ width: 4, height: 2, baseline: 0 });
  expect(textLayout(p, 0)).toBe(layout);
  const empty = player({ width: 8, height: 0, overflow: 'hidden' });
  expect(measureText(empty, 'label')).toEqual({ width: 8, height: 0, baseline: 0 });
});
it('caps active width constraints, ignores an auto-width authored width and accepts zero width', () => {
  const auto = player({ sizing: 'auto-width', width: 1 });
  expect(measureText(auto, 'label', 4)).toEqual({ width: 4, height: 6, baseline: 1.6 });
  const constrained = player({ sizing: 'auto-height', width: 4 });
  expect(measureText(constrained, 'label', 8)).toEqual({ width: 4, height: 6, baseline: 1.6 });
  expect(measureText(constrained, 'label', 0)).toEqual({ width: 0, height: 12, baseline: 1.6 });
});
