// Rottweiler P6 regressions (design/rottweiler/P6-LEDGER.md).
import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { drawFrame, load, Player } from '@anima-format/core';
import { select, type FieldNode } from '../../core/index.ts';
import { registerTextMeasurer } from '../../../text/core/measure.ts';
import { fixedMeasurer } from '../../../text/test/core/measurer.ts';
const field = (text: string, extra: Record<string, unknown> = {}, textInput = {}) => {
  registerTextMeasurer(fixedMeasurer);
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'field',
    grid: 20,
    requires: ['text', 'textinput', 'a11y', 'focus'],
    nodes: [
      {
        id: 'q',
        type: 'text',
        sizing: 'fixed',
        width: 12,
        height: 4,
        styles: { s: { size: 1 } },
        runs: [{ text, style: 's' }],
        textInput,
        ...extra,
      },
    ],
  });
  expect(diagnostics).toEqual([]);
  const p = new Player(model!);
  p.step(0);
  p.focusTarget('q');
  return p;
};
const caret = (p: Player, at: number) => {
  select(p, 'q', at);
  const n = drawFrame(p).nodes[0] as FieldNode;
  const lines = n.text!.layout.lines;
  const boxes = n.fieldBoxes!.filter((b) => b.width === 0.06);
  expect(boxes).toHaveLength(1);
  return [boxes[0]!.x, lines.findIndex((l) => l.baseline - l.ascent === boxes[0]!.y)];
};
it('R1-05: a caret before a paragraph separator stays at the end of its line', () => {
  const p = field('AB\n\nCD', {}, { multiline: true });
  expect(caret(p, 2)).toEqual([2, 0]); // after B, not before C
  expect(caret(p, 3)).toEqual([0, 1]); // the empty paragraph
  expect(caret(p, 4)).toEqual([0, 2]);
  expect(caret(p, 6)).toEqual([2, 2]);
});
it('R1-05: a caret at a soft wrap still starts the next line', () => {
  const p = field('ab cd', { width: 3 }, { multiline: true });
  expect(caret(p, 3)).toEqual([0, 1]);
});
it('R1-06: selection and caret boxes follow uniform fit scaling', () => {
  const p = field('AB', { width: 1, overflow: 'fit' });
  select(p, 'q', 0, 2);
  const n = drawFrame(p).nodes[0] as FieldNode;
  const line = n.text!.layout.lines[0]!;
  expect(n.text!.layout.scale).toBe(0.5);
  expect(n.fieldBoxes![0]).toMatchObject({ y: line.baseline - 0.4, height: 0.5, width: 1 });
});
it('R2-07: a caret on an empty line follows alignment and normalized origin', () => {
  for (const [text, extra, x] of [
    ['', { align: 'center' }, 6],
    ['a\n', { align: 'center' }, 6],
    ['', { align: 'right' }, 12],
    ['', { align: 'center', origin: [0.5, 0] }, 0],
  ] as const) {
    const p = field(text, extra, { multiline: true });
    expect(caret(p, text.length)[0]).toBe(x);
  }
});
it('R3-06: negative tracking selects the union of cluster advances, never a negative width', () => {
  const p = field('AB', { styles: { s: { size: 1, tracking: -3 } } });
  select(p, 'q', 0, 2);
  const n = drawFrame(p).nodes[0] as FieldNode;
  expect(n.fieldBoxes![0]).toMatchObject({ x: -2, width: 3 });
});
it('R3-07/R4-04: field semantic bounds follow animated dimensions', () => {
  registerTextMeasurer(fixedMeasurer);
  const { model } = load({
    anima: '0.1',
    name: 'field',
    grid: 20,
    requires: ['text', 'textinput', 'a11y', 'focus'],
    nodes: [
      {
        id: 'q',
        type: 'text',
        sizing: 'fixed',
        width: 10,
        height: 4,
        runs: [{ text: 'AB' }],
        textInput: {},
      },
    ],
    timelines: {
      t: {
        duration: 1,
        tracks: {
          'q.width': [
            [0, 10],
            [1, 5],
          ],
        },
      },
    },
    machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
  });
  const p = new Player(model!);
  // R4-04: a cached tree read at each width (glyph extents unchanged) still refreshes.
  p.step(0);
  expect(p.semantics()[0]!.bounds).toEqual([0, 0, 10, 4]);
  p.step(0.5);
  expect(p.semantics()[0]!.bounds).toEqual([0, 0, 7.5, 4]);
  p.step(0.5);
  expect(p.semantics()[0]!.bounds).toEqual([0, 0, 5, 4]);
});
it('R4-06: a negative cluster advance (kerning) still yields a nonnegative selection box', () => {
  // Prefix widths A = 12, AV = 6: V's advance is -6.
  registerTextMeasurer({
    measure: (font, text) => ({
      ...fixedMeasurer.measure(font, text),
      advances: Float64Array.from([12, 6].slice(0, [...text].length)),
    }),
  });
  const { model } = load({
    anima: '0.1',
    name: 'kerned',
    grid: 20,
    requires: ['text', 'textinput', 'a11y', 'focus'],
    nodes: [
      {
        id: 'q',
        type: 'text',
        sizing: 'fixed',
        width: 20,
        height: 4,
        runs: [{ text: 'AV' }],
        textInput: {},
      },
    ],
  });
  const p = new Player(model!);
  p.step(0);
  p.focusTarget('q');
  select(p, 'q', 1, 2);
  const n = drawFrame(p).nodes[0] as FieldNode;
  expect(n.fieldBoxes![0]).toMatchObject({ x: 6, width: 6 });
});
