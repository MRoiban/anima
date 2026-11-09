import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { drawFrame, load, Player, toSVG } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
import { edit, select, type FieldNode } from '../../core/index.ts';
import { registerTextMeasurer } from '../../../text/core/measure.ts';
import { fixedMeasurer } from '../../../text/test/core/measurer.ts';
const document = (textInput = {}) => ({
  anima: '0.1',
  name: 'placeholder',
  grid: 20,
  requires: ['text', 'textinput', 'a11y', 'focus'],
  nodes: [
    {
      id: 'q',
      type: 'text',
      sizing: 'fixed',
      width: 12,
      height: 4,
      styles: {
        s: { size: 1, fill: { color: '#12345680' }, stroke: { color: '#654321', width: 0.1 } },
      },
      runs: [{ text: '', style: 's' }],
      textInput: { placeholder: 'Find', caretColor: '#f00', ...textInput },
    },
  ],
});
function player(config = {}) {
  registerTextMeasurer(fixedMeasurer);
  const r = load(document(config));
  expect(r.diagnostics).toEqual([]);
  return new Player(r.model!);
}
it('default placeholder dims only glyph ink, preserves paint alpha and never dims caret/selection', () => {
  const p = player();
  p.step(0);
  p.focusTarget('q');
  const n = drawFrame(p).nodes[0] as FieldNode;
  expect(n.opacity).toBe(1);
  expect(n.text!.opacity).toBe(0.5);
  expect(n.text!.paints[0]).toMatchObject([{ color: '#12345680' }, { color: '#654321' }]);
  expect(n.fieldBoxes![0]!.color).toBe('#f00');
  expect(toSVG(p)).toContain('opacity="0.5"><text');
  edit(p, 'q', 'AB');
  p.step(0);
  expect((drawFrame(p).nodes[0] as FieldNode).text!.opacity).toBeUndefined();
  expect(toSVG(p)).not.toContain('opacity="0.5"><text');
  select(p, 'q', 0, 2);
  expect((drawFrame(p).nodes[0] as FieldNode).fieldBoxes![0]!.color).toBe('#b3d4fc');
  edit(p, 'q', '');
  p.step(0);
  expect((drawFrame(p).nodes[0] as FieldNode).text!.opacity).toBe(0.5);
});
it.each(['#369', '#33669980', 'currentColor'])(
  'authored placeholder solid paint %s replaces fill/stroke only while empty',
  (color) => {
    const p = player({ placeholderColor: color });
    p.step(0);
    const n = drawFrame(p).nodes[0] as FieldNode;
    expect(n.text!.paints[0]).toEqual([{ kind: 'fill', visible: true, color }]);
    expect(n.text!.opacity).toBeUndefined();
    edit(p, 'q', 'AB');
    p.step(0);
    expect((drawFrame(p).nodes[0] as FieldNode).text!.paints[0]).toHaveLength(2);
  },
);
it('both placeholder color spellings round trip', () => {
  const doc = document({ placeholderColor: '#369' });
  const xml = decompile(doc);
  expect(xml).toContain('placeholder-color="#369"');
  expect(compile(xml).doc).toEqual(doc);
});
it.each([42, 'red', 'url(x)'])('invalid placeholder paint %j has a precise diagnostic', (value) => {
  expect(load(document({ placeholderColor: value })).diagnostics).toContainEqual(
    expect.objectContaining({
      code: typeof value === 'number' ? 'type' : 'bad-value',
      pointer: '/nodes/0/textInput/placeholderColor',
      message: expect.any(String),
    }),
  );
});
