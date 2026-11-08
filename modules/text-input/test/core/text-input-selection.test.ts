import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { drawFrame, load, Player, toSVG } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
import { select, type FieldNode } from '../../core/index.ts';
import { registerTextMeasurer } from '../../../text/core/measure.ts';
import { fixedMeasurer } from '../../../text/test/core/measurer.ts';
const document = (color: unknown = '#ff0000') => ({
  anima: '0.1',
  name: 'selected',
  grid: 20,
  requires: ['text', 'textinput', 'a11y', 'focus'],
  nodes: [
    {
      id: 'q',
      type: 'text',
      sizing: 'fixed',
      width: 12,
      height: 4,
      styles: { s: { size: 1, fill: { color: '#00f' } } },
      runs: [{ text: 'ABCD', style: 's' }],
      textInput: { selectionColor: '#0f0', selectedTextColor: color },
    },
  ],
});
it('separates selected glyph paint from selection background and restores it on collapse/blur', () => {
  registerTextMeasurer(fixedMeasurer);
  const { model, diagnostics } = load(document());
  expect(diagnostics).toEqual([]);
  const p = new Player(model!);
  p.step(0);
  p.focusTarget('q');
  select(p, 'q', 1, 3);
  const n = drawFrame(p).nodes[0] as FieldNode;
  expect(n.fieldBoxes![0]!.color).toBe('#0f0');
  expect(n.text!.layout.lines[0]!.clusters.map((g) => g.run)).toEqual([0, 1, 1, 0]);
  expect(n.text!.paints[1]).toEqual([{ kind: 'fill', visible: true, color: '#ff0000' }]);
  expect(toSVG(p)).toMatch(/fill="#ff0000"[^>]*>BC<\/tspan>/);
  select(p, 'q', 2);
  expect(toSVG(p)).not.toContain('fill="#ff0000"');
  select(p, 'q', 0, 4);
  p.focusClear();
  expect(toSVG(p)).not.toContain('fill="#ff0000"');
});
it('round trips both selected-text-color spellings', () => {
  const xml = decompile(document());
  expect(xml).toContain('selected-text-color="#ff0000"');
  expect(compile(xml).doc).toEqual(document());
});
it.each([42, 'red', 'url(x)'])(
  'rejects invalid selected paint %j at its field pointer',
  (value) => {
    expect(load(document(value)).diagnostics).toContainEqual(
      expect.objectContaining({
        code: typeof value === 'number' ? 'type' : 'bad-value',
        pointer: '/nodes/0/textInput/selectedTextColor',
        message: expect.any(String),
      }),
    );
  },
);
it('can reuse gradient/stroke paints from a declared local style without changing fonts or metrics', () => {
  registerTextMeasurer(fixedMeasurer);
  const source = document();
  source.requires.push('paint');
  delete (source.nodes[0]!.textInput as { selectedTextColor?: unknown }).selectedTextColor;
  Object.assign(source.nodes[0]!.textInput, { selectedTextStyle: 'chosen' });
  Object.assign(source.nodes[0]!.styles, {
    chosen: {
      size: 99,
      fill: {
        type: 'linear',
        x1: 0,
        y1: 0,
        x2: 4,
        y2: 0,
        stops: [
          { position: 0, color: '#f00' },
          { position: 1, color: '#0f0' },
        ],
      },
      stroke: { color: '#000', width: 0.1 },
    },
  });
  expect(compile(decompile(source)).doc).toEqual(source);
  const result = load(source);
  expect(result.diagnostics).toEqual([]);
  const p = new Player(result.model!);
  p.step(0);
  p.focusTarget('q');
  select(p, 'q', 1, 3);
  const drawing = (drawFrame(p).nodes[0] as FieldNode).text!;
  expect(drawing.paints[1]).toMatchObject([
    { kind: 'fill', type: 'linear' },
    { kind: 'stroke', width: 0.1 },
  ]);
  expect(drawing.layout.lines[0]!.clusters[1]!.font.size).toBe(1);
  expect(toSVG(p)).toContain('linearGradient');
  expect(toSVG(p)).toContain('stroke-width="0.1"');
});
it('rejects missing selected styles with a repair hint', () => {
  const source = document();
  Object.assign(source.nodes[0]!.textInput, { selectedTextStyle: 'missing' });
  expect(load(source).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'text-input-config',
      pointer: '/nodes/0/textInput/selectedTextStyle',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
