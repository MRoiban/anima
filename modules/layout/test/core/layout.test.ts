import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import '../../../../packages/core/src/all.ts';
import { load, Player, drawFrame, toSVG, jsonSchema } from '../../../../packages/core/src/index.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
import { registerTextMeasurer } from '../../../text/core/measure.ts';
import { resolveLayout } from '../../core/index.ts';
const rect = (id: string, w = 2, h = 2, layout?: object) => ({
  id,
  type: 'rect',
  x0: 0,
  y0: 0,
  w,
  h,
  fill: { color: '#000' },
  ...(layout ? { layout } : {}),
});
function document(nodes: unknown[], extras: object = {}) {
  return { anima: '0.1', name: 'layout-test', grid: 20, requires: ['layout'], nodes, ...extras };
}
function player(nodes: unknown[], extras: object = {}) {
  const result = load(document(nodes, extras));
  expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(result.model!);
  p.step(0);
  return p;
}
const container = (children: unknown[], extra: object = {}) => ({
  id: 'root',
  type: 'layout',
  width: 20,
  height: 10,
  children,
  ...extra,
});
const box = (p: Player, id: string) => p.layoutBox(id)!;
it('paints the container before its children in SVG; boxes are defensive copies', () => {
  const p = player([container([rect('a')], { fill: { color: '#fff' }, corners: 1, padding: 1 })]);
  expect(box(p, 'a')).toEqual({ x: 1, y: 1, width: 2, height: 2 });
  const svg = toSVG(p);
  expect(svg).toContain('width="20" height="10" rx="1"');
  expect(svg).toContain('width="2" height="2"');
  const copy = box(p, 'a');
  copy.width = 100;
  expect(box(p, 'a').width).toBe(2);
  expect(p.layoutBox('absent')).toBeUndefined();
  expect(p.values()['a.layoutBox.x']).toBe(1);
});
it.each([
  ['row', [1, 1], [4, 1]],
  ['row-reverse', [17, 1], [14, 1]],
  ['column', [1, 1], [1, 4]],
  ['column-reverse', [1, 7], [1, 4]],
])('direction %s positions one line', (direction, a, b) => {
  const p = player([container([rect('a'), rect('b')], { direction, gap: 1, padding: 1 })]);
  expect([box(p, 'a').x, box(p, 'a').y]).toEqual(a);
  expect([box(p, 'b').x, box(p, 'b').y]).toEqual(b);
});
it.each([
  ['start', 0, 2],
  ['center', 8, 10],
  ['end', 16, 18],
  ['space-between', 0, 18],
  ['space-around', 4, 14],
  ['space-evenly', 16 / 3, 38 / 3],
])('justify %s', (justify, a, b) => {
  const p = player([container([rect('a'), rect('b')], { justify })]);
  expect(box(p, 'a').x).toBeCloseTo(a as number);
  expect(box(p, 'b').x).toBeCloseTo(b as number);
});
it.each([
  ['start', 0, 2],
  ['center', 4, 2],
  ['end', 8, 2],
  ['stretch', 0, 10],
])('cross alignment %s', (align, y, h) => {
  const p = player([container([rect('a')], { align })]);
  expect(box(p, 'a').y).toBe(y);
  expect(box(p, 'a').height).toBe(h);
});
it('explicit sizing prevents stretch; self alignment and physical margins override container alignment', () => {
  const p = player([
    container(
      [rect('a', 2, 2, { height: 3 }), rect('b', 2, 2, { alignSelf: 'end', margin: [1, 2, 3, 4] })],
      { align: 'stretch' },
    ),
  ]);
  expect(box(p, 'a').height).toBe(3);
  expect(box(p, 'b')).toEqual({ x: 6, y: 5, width: 2, height: 2 });
});
it('row/column gap pair and all four padding sides use physical axes', () => {
  const p = player([
    container([rect('a'), rect('b')], { gap: [3, 5], padding: [1, 2, 3, 4], direction: 'column' }),
  ]);
  expect(box(p, 'a')).toEqual({ x: 4, y: 1, width: 2, height: 2 });
  expect(box(p, 'b').y).toBe(6);
});
it('nested hug aggregates padding, margins and gap before top-down fill', () => {
  const inner = {
    id: 'inner',
    type: 'layout',
    direction: 'column',
    padding: [1, 2],
    gap: 1,
    layout: { width: 'fill' },
    children: [rect('a', 3, 2), rect('b', 4, 1)],
  };
  const p = player([container([inner], { padding: 1 })]);
  expect(box(p, 'inner')).toEqual({ x: 1, y: 1, width: 18, height: 6 });
  expect(box(p, 'b')).toEqual({ x: 2, y: 4, width: 4, height: 1 });
});
it('hug uses authored rect/circle/path, intrinsic image and component viewBox dimensions', () => {
  const p = player(
    [
      {
        id: 'root',
        type: 'layout',
        padding: 1,
        gap: 1,
        children: [
          rect('a', 2, 3),
          { id: 'c', type: 'circle', center: [3, 3], r: 2, fill: { color: '#000' } },
          { id: 'path', type: 'path', d: 'M2 3L5 3L5 5Z', fill: { color: '#000' } },
          { id: 'pic', type: 'image', asset: 'pic', x0: 0, y0: 0, width: 5, height: 6 },
          { id: 'instance', type: 'instance', component: 'badge' },
        ],
      },
    ],
    {
      requires: ['layout', 'assets', 'components', 'paint'],
      assets: { pic: { type: 'image', source: 'data:image/png;base64,AA==', width: 5, height: 6 } },
      components: { badge: { grid: 20, viewBox: [0, 0, 7, 8], nodes: [rect('badge')] } },
    },
  );
  expect(box(p, 'root').width).toBe(27);
  expect(box(p, 'root').height).toBe(10);
});
it('weighted fill freezes bounds and redistributes remaining space', () => {
  const p = player([
    container([
      rect('a', 2, 2, { width: 'fill(1)', minWidth: 8 }),
      rect('b', 2, 2, { width: 'fill(2)', maxWidth: 9 }),
      rect('c', 2, 2, { width: 'fill(1)' }),
    ]),
  ]);
  expect([box(p, 'a').width, box(p, 'b').width, box(p, 'c').width]).toEqual([8, 8, 4]);
  const q = player([
    container([
      rect('a', 1, 2, { width: 'fill', maxWidth: 3 }),
      rect('b', 1, 2, { width: 'fill' }),
    ]),
  ]);
  expect([box(q, 'a').width, box(q, 'b').width]).toEqual([3, 17]);
});
it('negative free space overflows fixed items, fill retains its minimum, no implicit shrink', () => {
  const p = player([
    container([rect('a', 25), rect('b', 1, 2, { width: 'fill', minWidth: 2 })], {
      justify: 'center',
    }),
  ]);
  expect(box(p, 'a').x).toBe(-3.5);
  expect(box(p, 'b').width).toBe(2);
});
it('display none removes the child and its gap but visible false still reserves space', () => {
  const p = player([
    container(
      [rect('a'), rect('hidden', 5, 5, { display: 'none' }), { ...rect('b'), visible: false }],
      { gap: 1 },
    ),
  ]);
  expect(box(p, 'hidden')).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  expect(box(p, 'b').x).toBe(3);
  expect(drawFrame(p).nodes[2]!.visible).toBe(false);
});
it('unchanged containers preserve their boxes and do not invalidate drawing', () => {
  const p = player([container([rect('a')])]);
  const revision = p.drawRevision;
  resolveLayout(p);
  expect(p.drawRevision).toBe(revision);
  p.step(0);
  expect(p.drawRevision).toBe(revision);
});
it('bindings take priority over timeline samples; numeric container and child addresses resolve before layout', () => {
  const p = player(
    [container([rect('a', 1, 2, { width: 1 }), rect('b')], { padding: 0, gap: 0 })],
    {
      requires: ['layout', 'bind'],
      inputs: { n: { type: 'number', default: 3 } },
      bind: {
        'root.width': 'n * 4',
        'root.gap': 'n',
        'root.padding.0': 'n',
        'a.layout.width': 'n * 2',
      },
      timelines: {
        size: {
          duration: 1,
          tracks: {
            'root.width': [
              [0, 20],
              [1, 40],
            ],
          },
        },
      },
      machine: { layers: { main: { initial: 'play', states: { play: { play: 'size' } } } } },
    },
  );
  expect(box(p, 'root').width).toBe(12);
  expect(box(p, 'a')).toEqual({ x: 0, y: 3, width: 6, height: 2 });
  expect(box(p, 'b').x).toBe(9);
  p.set('n', 4);
  p.step(0.5);
  expect(box(p, 'root').width).toBe(16);
  expect(box(p, 'b').x).toBe(12);
});
it('text hug tracks a data-bound run and aligns different baselines', () => {
  registerTextMeasurer({
    measure(font, text) {
      return {
        advances: new Float64Array([...text].map((_, i) => ((i + 1) * font.size) / 2)),
        ascent: font.size * 0.8,
        descent: font.size * 0.2,
        lineGap: 0,
        capHeight: font.size * 0.7,
        xHeight: font.size * 0.5,
      };
    },
  });
  const text = (id: string, size: number) => ({
    id,
    type: 'text',
    runs: [{ text: 'Hi', style: 'body' }],
    styles: { body: { size } },
  });
  const p = player(
    [
      container([text('small', 2), text('large', 4)], {
        align: 'baseline',
        width: 'hug',
        height: 'hug',
        padding: 1,
        gap: 1,
      }),
    ],
    { requires: ['layout', 'text'] },
  );
  expect(box(p, 'root').width).toBe(9);
  expect(box(p, 'small').y + 1.6).toBeCloseTo(box(p, 'large').y + 3.2);
});
it('both syntax spellings, nested layout attrs, decompile, schema and numeric timeline address translation', () => {
  const source =
    '<anima version="0.1" name="layout-test" grid="20" requires="layout"><layout id="root" width="20" height="10" fill="#fff"><rect id="a" x0="0" y0="0" width="2" height="2" layout-width="3" min-width="1" margin="1 2" align-self="end" fill="#000"/></layout><timeline name="grow" duration="1"><track target="a.layout-width">0 3; 1 8</track></timeline></anima>';
  const result = compile(source);
  expect(result.diagnostics).toEqual([]);
  const raw = JSON.parse(result.text!);
  expect(raw.nodes[0].children[0].layout).toEqual({
    width: 3,
    minWidth: 1,
    margin: [1, 2],
    alignSelf: 'end',
  });
  expect(raw.timelines.grow.tracks['a.layout.width']).toEqual([
    [0, 3],
    [1, 8],
  ]);
  expect(compile(decompile(raw)).text).toBe(result.text);
  expect(JSON.stringify(jsonSchema())).toContain('alignSelf');
});
describe('diagnostics', () => {
  const base = new URL('./invalid/', import.meta.url);
  const expected = JSON.parse(readFileSync(new URL('expected.json', base), 'utf8')) as Record<
    string,
    { code: string; pointer: string }
  >;
  it.each(Object.entries(expected))(
    '%s reports a precise pointer and actionable hint',
    (name, want) => {
      const result = load(readFileSync(new URL(name, base), 'utf8'));
      expect(result.model).toBeUndefined();
      const diagnostic = result.diagnostics.find((d) => d.code === want.code);
      expect(diagnostic).toMatchObject({ ...want, severity: 'error' });
      expect(diagnostic!.message.length).toBeGreaterThan(10);
      expect(diagnostic!.hint!.length).toBeGreaterThan(10);
    },
  );
});

it('mixed min/max violations freeze by the signed total, then redistribute', () => {
  const p = player([
    container(
      [
        rect('a', 1, 2, { width: 'fill', minWidth: 8 }),
        rect('b', 1, 2, { width: 'fill', maxWidth: 4 }),
      ],
      { width: 13 },
    ),
  ]);
  expect([box(p, 'a').width, box(p, 'b').width]).toEqual([9, 4]);
});
it('layout guards use the previous step and reject unknown box targets', () => {
  const p = player([container([rect('a')], { width: 4 })], {
    requires: ['layout', 'bind', 'machine'],
    inputs: { n: { type: 'number', default: 4 } },
    bind: { 'root.width': 'n' },
    machine: {
      layers: {
        main: {
          initial: 'small',
          states: {
            small: {
              pose: {},
              on: [
                {
                  when: '@after(0)',
                  guard: { left: { layout: 'root.width' }, op: '>=', right: 10 },
                  to: 'large',
                },
              ],
            },
            large: { pose: {}, on: [] },
          },
        },
      },
    },
  });
  p.set('n', 12);
  p.step(0);
  expect(p.states().main).toBe('small');
  p.step(0);
  expect(p.states().main).toBe('large');
  const raw = document([container([])], {
    requires: ['layout', 'machine'],
    machine: {
      layers: {
        main: {
          initial: 'a',
          states: {
            a: {
              pose: {},
              on: [
                {
                  when: '@after(0)',
                  guard: { left: { layout: 'missing.width' }, op: '>', right: 1 },
                  to: 'b',
                },
              ],
            },
            b: { pose: {} },
          },
        },
      },
    },
  });
  expect(load(raw).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'layout-target',
      pointer: '/machine/layers/main/states/a/on/0/guard/left/layout',
      hint: expect.any(String),
    }),
  );
});
it('display bindings remove a participant on the next step', () => {
  const p = player(
    [container([rect('a'), rect('b', 2, 2, { display: 'flex' }), rect('c')], { gap: 1 })],
    {
      requires: ['layout', 'bind', 'data'],
      data: { models: { Main: { properties: { shown: { type: 'string', default: 'flex' } } } } },
      bind: { 'b.layout.display': '$shown' },
    },
  );
  p.set('$shown', 'none');
  p.step(0);
  expect(box(p, 'c').x).toBe(3);
  expect(drawFrame(p).nodes[2]!.visible).toBe(false);
});

it('nested diagnostics keep the child attribute origin after compiling the container', () => {
  const source = `<anima version="0.1" name="invalid-layout" grid="20" requires="layout">
  <layout id="root" width="hug">
    <rect id="a" x0="0" y0="0" width="1" height="1" layout-width="fill" fill="#000"/>
  </layout>
</anima>`;
  expect(compile(source).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'layout-fill-hug',
      pointer: '/nodes/0/children/0/layout/width',
      line: 3,
    }),
  );
});
it('layout containers have hit outlines and child world positions follow their allocated boxes', () => {
  const p = player(
    [container([rect('a')], { x: 2, y: 2, padding: 1, fill: { color: '#fff' }, corners: 1 })],
    {
      inputs: { clicked: { type: 'bool' } },
      listeners: [{ on: 'click', target: 'root', set: { clicked: true } }],
    },
  );
  expect(p.world(1).slice(4)).toEqual([3, 3]);
  p.pointer('move', 3, 3);
  p.pointer('down', 3, 3);
  p.pointer('up', 3, 3);
  p.step(0);
  expect(p.get('clicked')).toBe(true);
});

it('baseline hug includes the largest ascent plus largest descent across fonts', () => {
  registerTextMeasurer({
    measure(font, text) {
      const a = font.family === 'a' ? 9 : 1;
      return {
        advances: Float64Array.from([...text], (_, i) => (i + 1) * 10),
        ascent: a,
        descent: 10 - a,
        capHeight: a,
        xHeight: a,
        lineGap: 0,
      };
    },
  });
  const node = (id: string) => ({
    id,
    type: 'text',
    runs: [{ text: 'X', style: id }],
    styles: { [id]: { font: id, size: 10 } },
  });
  const p = player(
    [container([node('a'), node('b')], { width: 'hug', height: 'hug', align: 'baseline' })],
    { requires: ['layout', 'text'] },
  );
  expect(box(p, 'root').height).toBe(18);
  expect(box(p, 'a').y).toBe(0);
  expect(box(p, 'b').y).toBe(8);
});

it('uses registered optional shape outlines for intrinsic dimensions', () => {
  const p = player(
    [
      {
        id: 'root',
        type: 'layout',
        gap: 1,
        children: [
          { id: 'ellipse', type: 'ellipse', cx: 0, cy: 0, rx: 2, ry: 3, fill: { color: '#000' } },
          {
            id: 'polygon',
            type: 'polygon',
            cx: 0,
            cy: 0,
            radius: 3,
            sides: 4,
            fill: { color: '#000' },
          },
        ],
      },
    ],
    { requires: ['layout', 'paint'] },
  );
  expect(box(p, 'ellipse').width).toBeCloseTo(4);
  expect(box(p, 'ellipse').height).toBeCloseTo(6);
  expect(box(p, 'polygon').width).toBeCloseTo(6);
  expect(box(p, 'root').width).toBeCloseTo(11);
});
it('normalizes very large finite fill weights before distributing', () => {
  const p = player([
    container([
      rect('a', 1, 1, { width: 'fill(1e308)' }),
      rect('b', 1, 1, { width: 'fill(1e308)' }),
    ]),
  ]);
  expect(box(p, 'a').width).toBe(10);
  expect(box(p, 'b').width).toBe(10);
});
it('a layout under an ordinary group fills the artboard as a layout root', () => {
  const p = player([
    {
      id: 'group',
      type: 'group',
      children: [{ id: 'root', type: 'layout', width: 'fill', height: 'fill', children: [] }],
    },
  ]);
  expect(box(p, 'root').width).toBe(20);
  expect(box(p, 'root').height).toBe(20);
});

it('a bound width replaces hug before validating a fill child', () => {
  const p = player(
    [container([rect('a', 1, 2, { width: 'fill' })], { width: 'hug', padding: 1 })],
    {
      requires: ['layout', 'bind'],
      inputs: { w: { type: 'number', default: 10 } },
      bind: { 'root.width': 'w' },
    },
  );
  expect(box(p, 'a').width).toBe(8);
  p.set('w', 14);
  p.step(0);
  expect(box(p, 'a').width).toBe(12);
});

it('rejects address-only child sizing outside a container', () => {
  const result = load(
    document([rect('a')], { requires: ['layout', 'bind'], bind: { 'a.layout.width': '4' } }),
  );
  expect(result.model).toBeUndefined();
  expect(result.diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'layout-outside',
      pointer: '/bind/a.layout.width',
      message: expect.any(String),
      hint: expect.any(String),
    }),
  );
});
