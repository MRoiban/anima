import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { drawFrame, load, Player, toSVG } from '@anima-format/core';
import { dataState } from '../../../data/core/storage.ts';
import { registerTextMeasurer, type TextDrawNode } from '../../core/index.ts';
import { fixedMeasurer } from './measurer.ts';
import { liveDocument } from '../live-document.ts';
function player() {
  registerTextMeasurer(fixedMeasurer);
  const { model, diagnostics } = load(liveDocument());
  expect(diagnostics).toEqual([]);
  const p = new Player(model!);
  p.data.bind('main');
  p.step(0);
  return p;
}
it('list text/style mutations redraw after a layout reader has refreshed the cache', () => {
  const p = player();
  expect(toSVG(p)).toContain('>AB</tspan>');
  p.data.string('items.0.label').set('WXYZ');
  p.data.textStyle('items.0.ink').set('alternate');
  p.step(0);
  const n = drawFrame(p).nodes[0] as TextDrawNode;
  expect(n.text!.layout.lines[0]!.width).toBe(8);
  expect(n.text!.runs).toEqual([{ id: undefined, text: 'WXYZ', style: 'alternate' }]);
  expect(toSVG(p)).toContain('>WXYZ</tspan>');
  expect(toSVG(p)).toContain('fill="#cc2200"');
});
it('typed text-style setters accept shared style names and clearing via core, storage and host', () => {
  const p = player();
  const h = p.data.textStyle('style');
  h.set('alternate');
  p.step(0);
  expect(p.get('$style')).toBe('alternate');
  expect(toSVG(p)).toContain('font-size="2"');
  p.set('$style', 'normal');
  p.step(0);
  expect(h.value).toBe('normal');
  const s = dataState(p)!;
  s.set('$style', 'alternate');
  expect(s.get('$style')).toBe('alternate');
  h.set('');
  p.step(0);
  expect(h.value).toBe('');
});
it.each([42, false, {}, 'missing'])(
  'rejects invalid typed style value %j without changing data',
  (value) => {
    const p = player();
    expect(() => p.data.textStyle('style').set(value as string)).toThrow(
      expect.objectContaining({
        code: 'data-type',
        pointer: '/data/$style',
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
    expect(() => dataState(p)!.set('$style', value as string)).toThrow('data-type $style');
    expect(() => p.set('$style', value as string)).toThrow();
    p.step(0);
    expect(p.get('$style')).toBe('normal');
  },
);
