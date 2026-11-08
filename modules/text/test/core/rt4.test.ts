import '@anima-format/core/all';
import { expect, it, beforeEach } from 'vitest';
import { load } from '@anima-format/core';
import { flattenText } from '../../../../packages/cli/src/font/flatten.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { ToolMeasurer } from '../../../../packages/cli/src/font/measure.ts';
import { testFont } from '../../../../tools/test-font.ts';
import { registerTextMeasurer } from '../../core/measure.ts';
const measurer = new ToolMeasurer();
measurer.register('sans-serif', new Font(testFont()));
beforeEach(() => registerTextMeasurer(measurer));
const label = {
  type: 'text',
  id: 'label',
  runs: [{ text: 'AB', style: 's' }],
  styles: { s: { size: 2, fill: { color: '#123456' } } },
};
const doc = (requires: string[], nodes: Record<string, unknown>[]) => ({
  anima: '0.1',
  name: 'flatten',
  grid: 20,
  requires,
  nodes,
});
it('R4-4: flattening refuses text that is a layout participant', () => {
  const row = doc(
    ['text', 'layout'],
    [
      {
        id: 'row',
        type: 'layout',
        children: [
          label,
          { id: 'dot', type: 'circle', r: 2, center: [2, 2], fill: { color: '#f00' } },
        ],
      },
    ],
  );
  expect(load(row).diagnostics).toEqual([]);
  expect(() => flattenText(row, measurer)).toThrow(
    expect.objectContaining({
      code: 'font-flatten',
      message: expect.stringMatching(/layout participant/),
    }),
  );
  // Text outside a layout container, including beside one, still flattens.
  const beside = doc(['text', 'layout'], [label, { id: 'row', type: 'layout', children: [] }]);
  expect((flattenText(beside, measurer).nodes as { type: string }[])[0]!.type).toBe('group');
});
