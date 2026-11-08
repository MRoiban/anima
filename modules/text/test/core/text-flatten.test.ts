import '@anima-format/core/all';
import { expect, it, beforeEach } from 'vitest';
import { load, Player, toSVG } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
import { Resvg } from '@resvg/resvg-js';
import { flattenText } from '../../../../packages/cli/src/font/flatten.ts';
import { outlineSVG } from '../../../../packages/cli/src/font/svg.ts';
import { Font } from '../../../../packages/cli/src/font/reader.ts';
import { ToolMeasurer } from '../../../../packages/cli/src/font/measure.ts';
import { testFont } from '../../../../tools/test-font.ts';
import { registerTextMeasurer } from '../../core/measure.ts';

const measurer = new ToolMeasurer();
measurer.register('sans-serif', new Font(testFont()));
beforeEach(() => registerTextMeasurer(measurer));
const label = (extra: Record<string, unknown> = {}) => ({
  type: 'text',
  id: 'label',
  runs: [{ text: 'AB', style: 's' }],
  styles: { s: { size: 2, fill: { color: '#123456' } } },
  lineHeight: 1,
  ...extra,
});
const doc = (nodes: Record<string, unknown>[] = [label()]): Record<string, unknown> => ({
  anima: '0.1',
  name: 'flatten',
  grid: 20,
  requires: ['text', 'paint', 'composite', 'components', 'data'],
  nodes,
});
function svg(document: Record<string, unknown>) {
  const result = load(document);
  expect(result.diagnostics).toEqual([]);
  const p = new Player(result.model!);
  p.step(0);
  return outlineSVG(toSVG(p), measurer);
}
function pixels(document: Record<string, unknown>) {
  return new Resvg(svg(document), { fitTo: { mode: 'width', value: 240 } }).render().pixels;
}
function match(document: Record<string, unknown>, node?: string) {
  const before = structuredClone(document);
  const out = flattenText(document, measurer, node);
  expect(document).toEqual(before);
  expect(pixels(out)).toEqual(pixels(document));
  expect(compile(decompile(JSON.stringify(out))).diagnostics).toEqual([]);
  return out;
}
it('freezes editable paths with original-font corners and both syntax round trips', () => {
  const out = match(doc());
  expect(JSON.stringify(out.nodes)).not.toContain('"type":"text"');
  expect(svg(out)).toContain('M0.1 1.6L1 1.6L1 0.2L0.1 0.2Z');
});
it('preserves external clips, masks, transforms and unaffected siblings', () => {
  const source = doc([
    { type: 'rect', id: 'crop', x0: 0, y0: 0, w: 2, h: 3, fill: { color: '#00000000' } },
    label({ x: 1, y: 1, rotate: 10, clip: { source: 'crop' } }),
    { type: 'circle', id: 'dot', center: [8, 8], r: 1, fill: { color: '#f00' } },
  ]);
  const out = match(source);
  expect((out.nodes as Record<string, unknown>[])[1]).toMatchObject({
    clip: { source: 'crop' },
    rotate: 10,
  });
  expect((out.nodes as unknown[])[2]).toEqual((source.nodes as unknown[])[2]);
  match(
    doc([
      { type: 'circle', id: 'mask', center: [1, 1], r: 1, fill: { color: '#00000088' } },
      label({ mask: { source: 'mask', mode: 'alpha', sourceDraws: false } }),
    ]),
  );
});
it.each([
  [1, 1],
  [0, 1],
  [2, 0],
])('retains a local overflow clip of %s by %s', (width, height) => {
  match(doc([label({ sizing: 'fixed', width, height, overflow: 'clipped' })]));
});
it('traverses component definitions with their own font styles, data defaults and colliding ids', () => {
  const source = doc([{ type: 'instance', id: 'a', component: 'caption' }]);
  source.components = {
    caption: {
      grid: 20,
      nodes: [label({ runs: [{ text: '$message', style: 's' }] })],
      data: {
        models: { Main: { properties: { message: { type: 'string', default: 'CD' } } } },
        instances: { main: { model: 'Main', default: true } },
      },
    },
  };
  const out = match(source);
  expect(JSON.stringify(out.components)).not.toContain('"type":"text"');
  expect(flattenText(source, measurer, 'caption/label')).toEqual(out);
  expect(() => flattenText(source, measurer, 'label')).toThrow(/no text node/);
});
it('snapshots shorthand defaults but rejects remaining text-only animation and binding references', () => {
  const source = doc([label({ runs: [{ text: '$message' }] })]);
  source.data = {
    models: { Main: { properties: { message: { type: 'string', default: 'CD' } } } },
    instances: { main: { model: 'Main', default: true } },
  };
  match(source);
  source.timelines = {
    change: {
      duration: 1,
      tracks: {
        'label.styles.s.size': [
          [0, 2],
          [1, 3],
        ],
      },
    },
  };
  expect(() => flattenText(source, measurer)).toThrow(
    expect.objectContaining({
      code: 'font-flatten',
      pointer: '',
      message: expect.stringContaining('remaining text references'),
      hint: expect.any(String),
    }),
  );
});
it('preserves group-address animation and rejects editable fields and unknown selections', () => {
  const source = doc();
  source.timelines = {
    move: {
      duration: 1,
      tracks: {
        'label.x': [
          [0, 0],
          [1, 3],
        ],
      },
    },
  };
  const out = match(source);
  expect(out.timelines).toEqual(source.timelines);
  expect(() => flattenText(doc([label({ textInput: {} })]), measurer)).toThrow(/editable field/);
  expect(() => flattenText(source, measurer, 'missing')).toThrow(
    expect.objectContaining({ code: 'font-flatten', pointer: '', hint: expect.any(String) }),
  );
});
it('retains gradients through the installed SVG backends', () => {
  const source = doc([
    label({
      styles: {
        s: {
          size: 2,
          fill: {
            type: 'linear',
            x1: 0,
            y1: 0,
            x2: 2,
            y2: 0,
            stops: [
              { position: 0, color: '#f00' },
              { position: 1, color: '#00f' },
            ],
          },
        },
      },
    }),
  ]);
  match(source);
});

it('retains per-glyph rotation effects', () => {
  const source = doc([label({ effects: [{ rotate: 15 }] })]);
  source.requires = [...(source.requires as string[]), 'texteffects'];
  match(source);
});

it('accepts flattened outlines against live generated-font text rasterization with the tool measurer', () => {
  // Independent live shaping/rasterization: do not pass this side through outlineSVG.
  const document = doc([
    label({
      x: 2,
      y: 2,
      rotate: 13,
      styles: { s: { font: 'Anima Test', size: 2, fill: { color: '#123456' } } },
    }),
  ]);
  measurer.register('Anima Test', new Font(testFont()));
  const original = load(document);
  expect(original.diagnostics).toEqual([]);
  const live = new Player(original.model!);
  live.step(0);
  const options = {
    fitTo: { mode: 'width' as const, value: 240 },
    font: { loadSystemFonts: false, fontFiles: ['fixtures/fonts/anima-test.ttf'] },
  };
  const reference = new Resvg(toSVG(live), options).render().pixels;
  const flat = flattenText(document, measurer);
  const outlined = load(flat);
  expect(outlined.diagnostics).toEqual([]);
  const p = new Player(outlined.model!);
  p.step(0);
  const actual = new Resvg(toSVG(p), options).render().pixels;
  // Identical vector contours are expected; no geometry tolerance or oracle threshold is added.
  expect(actual).toEqual(reference);
});
