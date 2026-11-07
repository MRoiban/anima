import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { compile, decompile } from '@anima-format/markup';
import { load, Player, toSVG, drawFrame } from '@anima-format/core';
import { registerTextMeasurer, textLayout, textRun } from '../../core/index.ts';
import { fixedMeasurer } from '../core/measurer.ts';
it('authors styles and runs structurally and roundtrips both spellings', () => {
  const xml = `<anima version="0.1" name="text" grid="20" requires="text"><text-style id="global" font="sans-serif" size="2"/><text id="title" width="5" height="4" sizing="fixed" word-break="break-all" line-height="1" paragraph-spacing="0.5" overflow="clipped"><style id="local" size="1" fill="#f00"/><run id="first" style="local" text="abc"/><run style="global" text="def"/></text></anima>`;
  const c = compile(xml);
  expect(c.diagnostics).toEqual([]);
  const raw = JSON.parse(c.text!);
  expect(raw.textStyles.global.size).toBe(2);
  expect(raw.nodes[0].styles.local.fill).toEqual({ color: '#f00' });
  const round = compile(decompile(raw));
  expect(round.diagnostics).toEqual([]);
  expect(JSON.parse(round.text!)).toEqual(raw);
  registerTextMeasurer(fixedMeasurer);
  const p = new Player(load(raw).model!);
  const svg = toSVG(p);
  expect(svg).toContain('>abc</tspan>');
  expect(svg).toContain('clipPath');
  expect(svg).toContain('fill="#f00"');
  const l = textLayout(p, 0);
  expect(textLayout(p, 0)).toBe(l);
  textRun(p, 'title', 'first', '<&');
  expect(textLayout(p, 0)).not.toBe(l);
  expect(toSVG(p)).toContain('&lt;&amp;');
  expect(drawFrame(p).nodes[0]).toHaveProperty('text');
});
it('binds run text and named style from data and invalidates cached layout', () => {
  registerTextMeasurer(fixedMeasurer);
  const doc = {
    anima: '0.1',
    name: 'bound',
    grid: 20,
    requires: ['text', 'data'],
    textStyles: { red: { size: 1, fill: { color: '#f00' } }, blue: { size: 2 } },
    data: {
      models: {
        Main: {
          properties: {
            title: { type: 'string', default: 'abc' },
            style: { type: 'text-style', default: 'red' },
          },
        },
      },
    },
    nodes: [{ id: 'label', type: 'text', runs: [{ text: '$title', style: '$style' }] }],
  };
  const r = load(doc);
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  const first = textLayout(p, 0);
  drawFrame(p);
  p.set('$title', 'defg');
  p.set('$style', 'blue');
  p.step(0);
  expect(textLayout(p, 0).contentWidth).toBe(8);
  expect(textLayout(p, 0)).not.toBe(first);
  expect(
    (drawFrame(p).nodes[0] as import('../../core/index.ts').TextDrawNode).text!.runs[0].text,
  ).toBe('defg');
});
it('accepts data run lists and configured field names', () => {
  registerTextMeasurer(fixedMeasurer);
  const r = load({
    anima: '0.1',
    name: 'list',
    grid: 20,
    requires: ['text', 'data'],
    data: {
      models: {
        Main: {
          properties: { items: { type: 'list', of: 'Item', default: [{ label: 'Hello' }] } },
        },
        Item: { properties: { label: { type: 'string' } } },
      },
    },
    nodes: [{ id: 'label', type: 'text', runs: '$items', textField: 'label' }],
  });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(r.model!);
  expect(textLayout(p, 0).contentWidth).toBe(5);
});
it('replaces named component runs without changing the sibling or source model', () => {
  registerTextMeasurer(fixedMeasurer);
  const r = load({
    anima: '0.1',
    name: 'nested',
    grid: 20,
    requires: ['text', 'components'],
    components: {
      child: {
        grid: 20,
        nodes: [{ id: 'label', type: 'text', runs: [{ id: 'value', text: 'before' }] }],
      },
    },
    nodes: [
      { id: 'a', type: 'instance', component: 'child' },
      { id: 'b', type: 'instance', component: 'child' },
    ],
  });
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  expect(textRun(p, 'a/label', 'value')).toBe('before');
  toSVG(p);
  expect(textRun(p, 'a/label', 'value', 'after')).toBe('after');
  expect(toSVG(p)).toContain('>after</tspan>');
  p.step(0);
  expect(textRun(p, 'a/label', 'value')).toBe('after');
  expect(textRun(p, 'b/label', 'value')).toBe('before');
  expect(textRun(new Player(r.model!), 'a/label', 'value')).toBe('before');
  expect(toSVG(p)).toContain('>after</tspan>');
});
it('animates style size and run strings through ordinary slots', () => {
  registerTextMeasurer(fixedMeasurer);
  const r = load({
    anima: '0.1',
    name: 'animated-text',
    grid: 20,
    requires: ['text'],
    nodes: [
      { id: 'label', type: 'text', styles: { s: { size: 1 } }, runs: [{ text: 'ab', style: 's' }] },
    ],
    timelines: {
      grow: {
        duration: 1,
        tracks: {
          'label.styles.s.size': [
            [0, 1],
            [1, 2],
          ],
          'label.runs.0.text': [
            [0, 'ab'],
            [1, 'cd'],
          ],
        },
      },
    },
    machine: { layers: { main: { initial: 'playing', states: { playing: { play: 'grow' } } } } },
  });
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  expect(textLayout(p, 0).width).toBe(2);
  p.step(0.5);
  expect(textLayout(p, 0).width).toBe(3);
  p.step(0.5);
  expect(toSVG(p)).toContain('>cd</tspan>');
});
it('uses paint gradients and strokes on rich run glyph outlines in both spellings', () => {
  registerTextMeasurer(fixedMeasurer);
  const raw = {
    anima: '0.1',
    name: 'paint-text',
    grid: 20,
    requires: ['text', 'paint'],
    nodes: [
      {
        id: 't',
        type: 'text',
        styles: {
          s: {
            size: 1,
            fill: {
              type: 'linear',
              x1: 0,
              y1: 0,
              x2: 4,
              y2: 0,
              stops: [
                { position: 0, color: '#f00' },
                { position: 1, color: '#00f' },
              ],
            },
            stroke: { color: '#000', width: 0.1 },
          },
        },
        runs: [{ style: 's', text: 'abc' }],
      },
    ],
  };
  const xml = decompile(raw);
  const c = compile(xml);
  expect(c.diagnostics).toEqual([]);
  expect(JSON.parse(c.text!)).toEqual(raw);
  const svg = toSVG(new Player(load(raw).model!));
  expect(svg).toContain('<linearGradient');
  expect(svg).toContain('fill="url(#ap0-0-fill)"');
  expect(svg).toContain('stroke-width="0.1"');
});
it('rejects duplicate shared and local style ids with actionable locations', () => {
  for (const [children, pointer] of [
    [
      '<text-style id="s"/><text-style id="s"/><text id="t"><run text="a"/></text>',
      '/textStyles/s',
    ],
    ['<text id="t"><style id="s"/><style id="s"/><run text="a"/></text>', '/nodes/0/styles/s'],
  ]) {
    const c = compile(
      `<anima version="0.1" name="duplicate" grid="20" requires="text">${children}</anima>`,
    );
    expect(c.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'duplicate-name',
        pointer,
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  }
});
it('animates a style size from its implicit default', () => {
  registerTextMeasurer(fixedMeasurer);
  const r = load({
    anima: '0.1',
    name: 'default-size',
    grid: 20,
    requires: ['text'],
    nodes: [{ id: 'label', type: 'text', styles: { s: {} }, runs: [{ text: 'ab', style: 's' }] }],
    timelines: {
      grow: {
        duration: 1,
        tracks: {
          'label.styles.s.size': [
            [0, 1],
            [1, 2],
          ],
        },
      },
    },
    machine: { layers: { main: { initial: 'play', states: { play: { play: 'grow' } } } } },
  });
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  p.step(0.5);
  expect(textLayout(p, 0).width).toBe(3);
});
it('treats data-list text fields as values even when they start with a dollar', () => {
  registerTextMeasurer(fixedMeasurer);
  const r = load({
    anima: '0.1',
    name: 'literal-list',
    grid: 20,
    requires: ['text', 'data'],
    data: {
      models: {
        Main: {
          properties: { items: { type: 'list', of: 'Item', default: [{ label: '$price' }] } },
        },
        Item: { properties: { label: { type: 'string' } } },
      },
    },
    nodes: [{ id: 'label', type: 'text', runs: '$items', textField: 'label' }],
  });
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  expect(textRun(p, 'label', 0)).toBe('$price');
  expect(textLayout(p, 0).width).toBe(6);
});
it('does not reinterpret an explicit binding result as a second data path', () => {
  registerTextMeasurer(fixedMeasurer);
  const r = load({
    anima: '0.1',
    name: 'bound-literal',
    grid: 20,
    requires: ['text', 'data'],
    data: { models: { Main: { properties: { label: { type: 'string', default: '$price' } } } } },
    bind: { 'title.runs.0.text': '$label' },
    nodes: [{ id: 'title', type: 'text', runs: [{ text: 'seed' }] }],
  });
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  expect(textRun(p, 'title', 0)).toBe('$price');
});
it('clamps resolved style fields through registry numeric bounds', () => {
  registerTextMeasurer(fixedMeasurer);
  const r = load({
    anima: '0.1',
    name: 'style-bounds',
    grid: 20,
    requires: ['text'],
    nodes: [{ id: 'label', type: 'text', styles: { s: {} }, runs: [{ text: 'a', style: 's' }] }],
    timelines: {
      t: {
        duration: 1,
        tracks: {
          'label.styles.s.size': [
            [0, -1],
            [1, 2],
          ],
          'label.styles.s.weight': [
            [0, 2000],
            [1, 400],
          ],
        },
      },
    },
    machine: { layers: { main: { initial: 'p', states: { p: { play: 't' } } } } },
  });
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  expect(p.value('label.styles.s.size')).toBe(Number.MIN_VALUE);
  expect(p.value('label.styles.s.weight')).toBe(1000);
});
it('scales fitted SVG glyphs once at the run level', () => {
  registerTextMeasurer(fixedMeasurer);
  const p = new Player(
    load({
      anima: '0.1',
      name: 'fit-svg',
      grid: 20,
      requires: ['text'],
      nodes: [
        {
          id: 'label',
          type: 'text',
          sizing: 'fixed',
          width: 2,
          height: 2,
          wrap: false,
          overflow: 'fit',
          runs: [{ text: 'abcd' }],
        },
      ],
    }).model!,
  );
  const svg = toSVG(p);
  expect(svg.match(/transform="scale\(0\.5\)"/g)).toHaveLength(1);
  expect(textLayout(p, 0).lines[0]!.width).toBe(2);
});
it('passes generated-font SVG through the P6-2 outline converter', async () => {
  const { ToolMeasurer } = await import('../../../../packages/cli/src/font/measure.ts');
  const { Font } = await import('../../../../packages/cli/src/font/reader.ts');
  const { outlineSVG } = await import('../../../../packages/cli/src/font/svg.ts');
  const { testFont } = await import('../../../../tools/test-font.ts');
  const measurer = new ToolMeasurer();
  measurer.register('sans-serif', new Font(testFont()));
  registerTextMeasurer(measurer);
  const p = new Player(
    load({
      anima: '0.1',
      name: 'font-outline',
      grid: 20,
      requires: ['text'],
      nodes: [{ id: 'label', type: 'text', runs: [{ text: 'AV  x' }] }],
    }).model!,
  );
  const svg = outlineSVG(toSVG(p), measurer);
  expect(svg).toContain('<path d=');
  expect(svg).not.toContain('<text');
  expect(textLayout(p, 0).width).toBeCloseTo(2.3, 6);
});
it('renders zero-area fitted boxes without zero-size font requests or invalid coordinates', async () => {
  const { ToolMeasurer } = await import('../../../../packages/cli/src/font/measure.ts');
  const { Font } = await import('../../../../packages/cli/src/font/reader.ts');
  const { testFont } = await import('../../../../tools/test-font.ts');
  const measurer = new ToolMeasurer();
  measurer.register('sans-serif', new Font(testFont()));
  registerTextMeasurer(measurer);
  for (const overflow of ['fit', 'fit-font-size'])
    for (const [width, height] of [
      [0, 2],
      [2, 0],
    ]) {
      const p = new Player(
        load({
          anima: '0.1',
          name: 'zero-fit',
          grid: 20,
          requires: ['text'],
          nodes: [
            {
              id: 'label',
              type: 'text',
              sizing: 'fixed',
              width,
              height,
              overflow,
              fitFromBaseline: true,
              fitFontSizeResizesBox: true,
              runs: [{ text: 'AV' }],
            },
          ],
        }).model!,
      );
      const svg = toSVG(p);
      expect(svg).not.toContain('NaN');
      expect(svg).not.toContain('<tspan');
      expect(textLayout(p, 0).lines).toEqual([]);
    }
});
