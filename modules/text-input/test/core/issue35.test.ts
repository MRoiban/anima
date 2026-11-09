import '@anima-format/core/all';
import { drawFrame, load, Player, runScript, toSVG } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
import { expect, it } from 'vitest';
import { select, type FieldNode } from '../../core/index.ts';
import { registerTextMeasurer } from '../../../text/core/measure.ts';
import { fixedMeasurer } from '../../../text/test/core/measurer.ts';
const doc = (textInput = {}, multiline = false) => ({
  anima: '0.1',
  name: 'issue35',
  grid: 20,
  requires: ['text', 'textinput', 'a11y', 'focus', 'bind'],
  inputs: { secret: { type: 'bool', default: true } },
  nodes: [
    {
      id: 'q',
      type: 'text',
      sizing: 'fixed',
      width: 3,
      height: 1,
      styles: { s: { size: 1, fill: { color: '#0000ff' } } },
      runs: [{ text: multiline ? 'AB\nCD\nEF' : 'ABCDEFG', style: 's' }],
      textInput: { multiline, ...textInput },
    },
  ],
});
function player(d = doc()) {
  registerTextMeasurer(fixedMeasurer);
  const r = load(d);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  return p;
}
const node = (p: Player) => drawFrame(p).nodes[0] as FieldNode;
it('35: obscured is a bool binding, masks live, and updates semantics without changing selection', () => {
  const d = { ...doc(), bind: { 'q.textInput.obscured': 'secret' } };
  const p = player(d);
  p.focusTarget('q');
  select(p, 'q', 1, 4);
  expect(node(p).text!.runs[0]!.text).toBe('•••••••');
  expect(p.semantics()[0]!.value).toBeUndefined();
  p.set('secret', false);
  p.step(0);
  expect(node(p).text!.runs[0]!.text).toBe('ABCDEFG');
  expect(p.semantics()[0]!.value).toBe('ABCDEFG');
  expect(p.prop(0, 'textInput.obscured')).toBe(false);
});
it('35: new option spellings round trip and selected glyphs override highlight ink only', () => {
  const d = doc({ caretBlink: false, selectionTextColor: '#ff0000', selectionColor: '#00ff00' });
  const xml = decompile(d);
  expect(xml).toContain('caret-blink="false"');
  expect(xml).toContain('selection-text-color="#ff0000"');
  expect(compile(xml).doc).toEqual(d);
  const p = player(d);
  p.focusTarget('q');
  select(p, 'q', 1, 2);
  expect(node(p).text!.paints[1]).toEqual([{ kind: 'fill', visible: true, color: '#ff0000' }]);
  expect(node(p).fieldBoxes![0]!.color).toBe('#00ff00');
});
it.each([false, true])(
  '35: scroll to caret is clipped, keeps box size, and preserves cached layout (multiline=%s)',
  (multi) => {
    const p = player(doc({}, multi));
    p.focusTarget('q');
    select(p, 'q', multi ? 8 : 7);
    const n = node(p),
      layout = n.text!.layout;
    expect([layout.width, layout.height]).toEqual([3, 1]);
    expect(layout.clip).toEqual([0, 0, 3, 1]);
    const caret = n.fieldBoxes!.at(-1)!;
    expect(caret.x).toBeGreaterThanOrEqual(0);
    expect(caret.x + caret.width).toBeLessThanOrEqual(3.000001);
    expect(caret.y).toBeGreaterThanOrEqual(0);
    expect(caret.y + caret.height).toBeLessThanOrEqual(1.000001);
    expect(toSVG(p)).toContain('clip-path=');
    select(p, 'q', 0);
    expect(node(p).text!.layout.lines[0]!.clusters[0]!.x).toBe(0);
    expect(node(p).text!.layout.lines[0]!.clusters[0]!.y).toBeCloseTo(0.8);
  },
);
it('35: no selection foreground option retains field paint; static caret stays visible and idle steps settle', () => {
  const p = player();
  const idle = p.step(1);
  expect(idle.settled).toBe(true);
  p.focusTarget('q');
  select(p, 'q', 0, 2);
  expect(node(p).text!.paints).toHaveLength(1);
  select(p, 'q', 1);
  const before = toSVG(p);
  p.step(1.59);
  expect(toSVG(p)).toBe(before);
  p.focusClear();
  expect(p.step(1).settled).toBe(true);
});
it.each([{ caretBlink: 'yes' }, { selectionTextColor: 'red' }])(
  '35: invalid option has a precise registry diagnostic %j',
  (c) => {
    const errors = load(doc(c)).diagnostics;
    expect(errors).toContainEqual(
      expect.objectContaining({
        code: typeof Object.values(c)[0] === 'string' && 'caretBlink' in c ? 'type' : 'bad-value',
        pointer: '/nodes/0/textInput/' + Object.keys(c)[0],
        message: expect.any(String),
      }),
    );
  },
);

it('35 conformance: binding snapshots and unfocused step results are deterministic across elapsed times', () => {
  const p = player({ ...doc(), bind: { 'q.textInput.obscured': 'secret' } });
  const result = runScript(
    p.model,
    'advance 0\nsnapshot q.textInput.obscured\nset secret false\nadvance 0\nsnapshot q.textInput.obscured\nadvance 1.59\nsnapshot q.textInput.obscured',
  );
  expect(result.snapshots).toEqual([
    { time: 0, values: { 'q.textInput.obscured': true }, states: {}, events: [], settled: true },
    { time: 0, values: { 'q.textInput.obscured': false }, states: {}, events: [], settled: true },
    {
      time: 1.59,
      values: { 'q.textInput.obscured': false },
      states: {},
      events: [],
      settled: true,
    },
  ]);
});
