import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Player, load, toSVG, jsonSchema, nodeShape } from '../../../../packages/core/src/index.ts';
import { pathLength } from '../../../../packages/core/src/path.ts';
import { compile, decompile } from '../../../../packages/markup/src/index.ts';
const doc = (node: object) => ({
  anima: '0.1',
  name: 'geometry',
  grid: 20,
  requires: ['paint'],
  nodes: [{ id: 'a', fill: { color: '#000' }, ...node }],
});
const shapes = [
  { type: 'ellipse', cx: 10, cy: 10, rx: 8, ry: 4 },
  { type: 'polygon', cx: 10, cy: 10, sides: 5, radius: 8, cornerRadius: 1 },
  { type: 'star', cx: 10, cy: 10, points: 5, radius: 8, innerRadius: 4, cornerRadius: 1 },
  { type: 'triangle', x0: 2, y0: 2, width: 16, height: 16 },
  { type: 'rect', x0: 2, y0: 2, w: 16, h: 16, corners: [1, 2, 0, 3] },
];
describe('paint geometry', () => {
  it.each(shapes)('renders and round trips $type', (node) => {
    const d = doc(node),
      r = load(d);
    expect(r.diagnostics).toEqual([]);
    const svg = toSVG(new Player(r.model!));
    expect(svg).toMatch(/<path[^>]* d="M/);
    expect(svg).not.toMatch(/NaN|undefined/);
    expect(compile(decompile(d)).doc).toEqual(d);
    expect(jsonSchema()).toBeTruthy();
  });
  it.each([
    [{ ...shapes[0], rx: -1 }, '/nodes/0/rx'],
    [{ ...shapes[1], sides: 2 }, '/nodes/0/sides'],
    [{ ...shapes[1], sides: 3.5 }, '/nodes/0/sides'],
    [{ ...shapes[2], points: 1 }, '/nodes/0/points'],
    [{ ...shapes[3], width: -1 }, '/nodes/0/width'],
    [{ ...shapes[4], corners: [1, 2, 3] }, '/nodes/0/corners'],
    [{ ...shapes[4], corners: [1, -1, 0, 0] }, '/nodes/0/corners/1'],
    [{ ...shapes[0], stroke: { color: '#000', scale: 'bad' } }, '/nodes/0/stroke/scale'],
  ])('rejects invalid geometry %j', (node, pointer) => {
    const r = load(doc(node));
    expect(r.model).toBeUndefined();
    expect(r.diagnostics).toContainEqual(expect.objectContaining({ code: 'bad-value', pointer }));
  });
  it('keeps selected inline subpaths when paint is registered', () => {
    const r = load(doc({ type: 'path', d: 'M0 0L2 2M10 10L12 12', subpaths: [1] }));
    expect(r.diagnostics).toEqual([]);
    const svg = toSVG(new Player(r.model!));
    expect(svg).toContain('d="M10 10L12 12"');
    expect(svg).not.toContain('M0 0L2 2');
  });
  it('keeps legacy rx and registers the new keys with feature paint', () => {
    expect(nodeShape('rect').p.corners?.feature).toBe('paint');
    const r = load(doc({ type: 'rect', x0: 0, y0: 0, w: 10, h: 10, rx: 2 }));
    expect(toSVG(new Player(r.model!))).toContain('<rect');
    const d = { ...doc(shapes[0]!), requires: [] };
    expect(load(d).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'undeclared-feature', pointer: '/nodes/0/type' }),
    );
  });
  it('morphs glyph-backed paths, samples relative commands and blends without losing structure', () => {
    const d = {
      ...doc({ type: 'path', glyph: 'g' }),
      glyphs: { g: { d: 'M0 0l10 0Z' } },
      timelines: {
        t: {
          duration: 1,
          tracks: {
            'a.d': [
              [0, 'M0 0l10 0Z'],
              [1, 'M2 4l20 0Z'],
            ],
          },
        },
      },
      machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
    };
    const r = load(d);
    expect(r.diagnostics).toEqual([]);
    const p = new Player(r.model!);
    p.step(0.5);
    expect(p.value('a.d')).toBe('M1 2l15 0Z');
    expect(toSVG(p)).toContain('d="M1 2l15 0Z"');
    expect(compile(decompile(d)).doc).toEqual(d);
  });
  it.each([
    ['M0 0C1 2 3 4 5 6', 'morph-mismatch', 'match segment 1: expected L, got C'],
    ['M0 0', 'morph-mismatch', 'match segment 1: expected L, got end'],
    ['no path', 'bad-path', 'use valid SVG path data'],
    [42, 'value-type', 'use an SVG path string'],
  ])('diagnoses invalid morph %s', (value, code, hint) => {
    const d = {
      ...doc({ type: 'path', d: 'M0 0L2 2' }),
      timelines: { t: { duration: 1, tracks: { 'a.d': [[0, value]] } } },
    };
    expect(load(d).diagnostics).toContainEqual(
      expect.objectContaining({ code, pointer: '/timelines/t/tracks/a.d/0/1', hint }),
    );
  });
  it.each([
    ['M0 0C1 2 3 4 5 6', 'morph-mismatch', 'match segment 1: expected L, got C'],
    ['M0 0', 'morph-mismatch', 'match segment 1: expected L, got end'],
    ['no path', 'bad-path', 'use valid SVG path data'],
    [42, 'value-type', 'use an SVG path string'],
  ])('diagnoses invalid pose morph %s in both formats', (value, code, hint) => {
    const d = {
      ...doc({ type: 'path', d: 'M0 0L2 2' }),
      machine: { layers: { l: { initial: 's', states: { s: { pose: { 'a.d': value } } } } } },
    };
    const expected = { code, pointer: '/machine/layers/l/states/s/pose/a.d', hint };
    expect(load(d).diagnostics).toContainEqual(expect.objectContaining(expected));
    // AniML path values are strings; numeric-looking strings reach the path parser.
    if (typeof value === 'string') {
      const result = compile(decompile(d));
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          ...expected,
          line: expect.any(Number),
          column: expect.any(Number),
        }),
      );
    }
  });
  it('measures closed lines, cubics and arcs and shares absolute relative lengths between static and live SVG', () => {
    expect(pathLength('M0 0L3 0L3 4Z')).toBe(12);
    expect(pathLength('M10 0A10 10 0 0 1 0 10')).toBeCloseTo(5 * Math.PI, 2);
    const r = load(
      doc({
        type: 'path',
        d: 'M0 0L20 0',
        stroke: { color: '#000', dash: ['10%', '5%'], dashOffset: 0.1 },
      }),
    );
    const p = new Player(r.model!);
    expect(toSVG(p)).toContain('stroke-dasharray="2 1" stroke-dashoffset="2"');
    const svg = toSVG(p, { staticLengths: true });
    expect(svg).toBe(toSVG(p));
    expect(svg).not.toContain('pathLength');
    expect(svg).toContain('stroke-dasharray="2 1" stroke-dashoffset="2"');
  });
});

// B14: an independent quarter-circle midpoint, not a quadratic through the corner.
it('B14: 40px pill corners are circular cubics and clamped axes are elliptical', () => {
  for (const [w, h, a, b] of [
    [40, 40, 20, 20],
    [40, 20, 20, 10],
  ]) {
    const r = load(doc({ type: 'rect', x0: 0, y0: 0, w, h, corners: [20, 20, 20, 20] }));
    const svg = toSVG(new Player(r.model!));
    const k = (4 * (Math.sqrt(2) - 1)) / 3;
    const f = (n: number) => String(Number(n.toFixed(5)));
    expect(svg).toContain(`M0 ${b}C0 ${f(b * (1 - k))} ${f(a * (1 - k))} 0 ${a} 0`);
    expect(svg).not.toContain('Q');
  }
});

it('B14: drawing conformance for paint-shape-corners at 0, 0.5 and 1s', () => {
  const base = new URL('../../../../spec/conformance/paint-shape-corners/', import.meta.url);
  const r = load(readFileSync(new URL('case.ani', base), 'utf8'));
  const paths = JSON.parse(readFileSync(new URL('expected-paths.json', base), 'utf8')) as string[];
  const p = new Player(r.model!);
  paths.forEach((d, i) => {
    p.step(i ? 0.5 : 0);
    expect(toSVG(p)).toContain(`d="${d}"`);
  });
});
