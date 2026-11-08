import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { load, Player, drawFrame, toSVG } from '@anima-format/core';
import { compile, decompile } from '@anima-format/markup';
import { registerTextMeasurer } from '../../../text/core/index.ts';
import { fixedMeasurer } from '../../../text/test/core/measurer.ts';
import { type EffectDrawing, type EffectCluster } from '../../core/index.ts';
import { pathSampler } from '../../core/evaluate.ts';
import type { TextDrawNode } from '../../../text/core/index.ts';
const base = () => ({
  anima: '0.1',
  name: 'effects',
  grid: 20,
  requires: ['text', 'texteffects'],
  nodes: [{ id: 'label', type: 'text', runs: [{ id: 'first', text: 'abc' }], effects: [{ y: 1 }] }],
});
function drawing(doc: object) {
  registerTextMeasurer(fixedMeasurer);
  const r = load(doc);
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  p.step(0);
  const f = drawFrame(p);
  return { p, f, data: (f.nodes[0] as TextDrawNode).text as EffectDrawing };
}
for (const name of readdirSync('modules/text-effects/capabilities'))
  it('independent drawing conformance and AniML round trip: ' + name, () => {
    const dir = 'spec/conformance/' + name + '/';
    const c = compile(readFileSync(dir + 'case.animl', 'utf8'));
    expect(c.diagnostics).toEqual([]);
    const { data, p } = drawing(c.doc!);
    const clusters = data.layout.lines.flatMap((l) => l.clusters) as EffectCluster[];
    const got = {
      firstMatrix: clusters[0]!.matrix,
      alphas: clusters.map((c) => c.alpha),
      firstAxes: clusters[0]!.font.axes,
      backgrounds: data.backgrounds,
      direction: data.direction,
    };
    const expected = JSON.parse(readFileSync(dir + 'effects.expected.json', 'utf8'));
    for (const [k, v] of Object.entries(expected)) {
      if (Array.isArray(v) && typeof v[0] === 'number')
        v.forEach((n, i) => expect((got[k as keyof typeof got] as number[])[i]).toBeCloseTo(n, 6));
      else expect(got[k as keyof typeof got]).toEqual(v);
    }
    const markup = decompile(c.doc!);
    expect(compile(markup).doc).toEqual(c.doc);
    const svg = toSVG(p);
    expect(svg).toContain(
      name === 'text-background'
        ? '<rect'
        : name === 'text-script-direction'
          ? 'direction="rtl"'
          : 'matrix(',
    );
  });
for (const [effect, code, suffix] of [
  [{ start: 3, end: 1 }, 'text-range', '/end'],
  [{ run: 'missing' }, 'text-effect-run', '/run'],
  [{ followPath: 'bad' }, 'text-effect-path', '/followPath'],
  [{ ease: 'nonsense' }, 'bad-ease', '/ease'],
  [{ ranges: [{ start: 3, end: 1 }] }, 'text-range', '/ranges/0/end'],
] as const)
  it('semantic diagnostic ' + code + suffix, () => {
    const doc = base();
    doc.nodes[0]!.effects = [effect as unknown as { y: number }];
    const diagnostic = load(doc).diagnostics.find((d) => d.code === code);
    expect(diagnostic).toMatchObject({
      code,
      pointer: '/nodes/0/effects/0' + suffix,
      severity: 'error',
    });
    expect(diagnostic!.message.length).toBeGreaterThan(5);
    expect(diagnostic!.hint).toBeTruthy();
  });
for (const [key, value] of [
  ['opacity', 2],
  ['units', 'bytes'],
  ['combine', 'divide'],
  ['falloff', -1],
  ['axes', { invalid: 1 }],
  ['ranges', false],
] as const)
  it('registry rejects ' + key, () => {
    const doc = base();
    doc.nodes[0]!.effects = [{ [key]: value }] as { y: number }[];
    expect(load(doc).diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'error',
          pointer: expect.stringContaining('/effects/0/' + key),
        }),
      ]),
    );
  });
it('undeclared feature and invalid direction', () => {
  const doc = base();
  doc.requires = ['text'];
  expect(
    load(doc).diagnostics.some(
      (d) => d.code === 'undeclared-feature' && d.pointer === '/nodes/0/effects',
    ),
  ).toBe(true);
  const invalid = { ...base(), nodes: [{ ...base().nodes[0], direction: 'sideways' }] };
  expect(load(invalid).diagnostics.some((d) => d.pointer === '/nodes/0/direction')).toBe(true);
});
it('range-local animation changes drawing without mutating cached layout; seeks restart from rest', () => {
  const doc = {
    ...base(),
    timelines: {
      wave: {
        duration: 1,
        tracks: {
          'label.effects.0.y': [
            [0, 2],
            [1, 0],
          ],
        },
      },
    },
    machine: { layers: { main: { initial: 'wave', states: { wave: { play: 'wave' } } } } },
  };
  const { p, data } = drawing(doc);
  const before = (data.layout.lines[0]!.clusters[0] as EffectCluster).matrix[5];
  p.step(0.5);
  const after = (drawFrame(p).nodes[0] as TextDrawNode).text as EffectDrawing;
  expect((after.layout.lines[0]!.clusters[0] as EffectCluster).matrix[5]).toBeCloseTo(1);
  expect(before).toBeCloseTo(2);
});
it('line ranges, grapheme clusters, zero length paths, closed paths and tangents', () => {
  const doc = {
    ...base(),
    nodes: [
      {
        ...base().nodes[0],
        runs: [{ text: 'á\nb😀' }],
        effects: [{ units: 'lines', start: 1, opacity: 0 }],
      },
    ],
  };
  const { data } = drawing(doc);
  expect(data.layout.lines.map((l) => l.clusters.map((c) => (c as EffectCluster).alpha))).toEqual([
    [1],
    [0, 0],
  ]);
  expect(pathSampler('M0 0 L0 0')(2)).toEqual([0, 0, 0]);
  expect(pathSampler('M0 0 L0 10')(5)).toEqual([0, 5, Math.PI / 2]);
  pathSampler('M0 0 L1 0 L1 1 Z')(100)
    .slice(0, 2)
    .forEach((v) => expect(v).toBeCloseTo(0, 12));
});
it('word selection preserves hard breaks and scopes indexes to runs', () => {
  const doc = {
    ...base(),
    nodes: [
      {
        ...base().nodes[0],
        runs: [{ id: 'first', text: 'ab\ncd' }],
        effects: [{ units: 'words', start: 1, opacity: 0 }],
      },
    ],
  };
  const { data } = drawing(doc);
  expect(data.layout.lines.map((l) => l.clusters.map((c) => (c as EffectCluster).alpha))).toEqual([
    [1, 1],
    [0, 0],
  ]);
});
it('rounded backgrounds resolve slots in static SVG and reject invalid colors and run ids', () => {
  const doc = {
    ...base(),
    colors: { highlight: '#ff0000' },
    nodes: [{ ...base().nodes[0], background: { first: { color: 'highlight', radius: 0.2 } } }],
  };
  const { p } = drawing(doc);
  expect(toSVG(p)).toContain('rx="0.2"');
  expect(toSVG(p)).toContain('fill="#ff0000"');
  for (const [background, code] of [
    [{ first: 'invalid' }, 'text-background-color'],
    [{ unknown: '#000' }, 'text-effect-run'],
  ] as const) {
    const d = load({ ...base(), nodes: [{ ...base().nodes[0], background }] }).diagnostics.find(
      (d) => d.code === code,
    )!;
    expect(d.pointer).toBe('/nodes/0/background/' + Object.keys(background)[0]);
    expect(d.hint).toBeTruthy();
    expect(d.message).toBeTruthy();
  }
});
it('axes and omitted numeric defaults animate through ordinary numeric slots', () => {
  const doc = {
    ...base(),
    nodes: [{ ...base().nodes[0], effects: [{ axes: { wght: 400 } }] }],
    timelines: {
      wave: {
        duration: 1,
        tracks: {
          'label.effects.0.axes.wght': [
            [0, 400],
            [1, 800],
          ],
          'label.effects.0.opacity': [
            [0, 0],
            [1, 1],
          ],
        },
      },
    },
    machine: { layers: { main: { initial: 'wave', states: { wave: { play: 'wave' } } } } },
  };
  const { p } = drawing(doc);
  p.step(0.5);
  const c = (drawFrame(p).nodes[0] as TextDrawNode).text!.layout.lines[0]!
    .clusters[0] as EffectCluster;
  expect(c.alpha).toBeCloseTo(0.5);
  expect(c.font.axes!.wght).toBe(600);
});
it('diagnostic pointers escape run ids and follow paths reject nonfinite coordinates', () => {
  const d = load({
    ...base(),
    nodes: [{ ...base().nodes[0], background: { 'x/y': '#000' } }],
  }).diagnostics.find((d) => d.code === 'text-effect-run')!;
  expect(d.pointer).toBe('/nodes/0/background/x~1y');
  const path = load({
    ...base(),
    nodes: [{ ...base().nodes[0], effects: [{ followPath: 'M1e309 0 L1 1' }] }],
  }).diagnostics.find((d) => d.code === 'text-effect-path')!;
  expect(path.pointer).toBe('/nodes/0/effects/0/followPath');
  expect(path.hint).toBeTruthy();
});
it('benchmark title wave reveals letters over the selected two-word range', () => {
  const c = compile(readFileSync('modules/text-effects/examples/title-wave.animl', 'utf8'));
  expect(c.diagnostics).toEqual([]);
  const { p, data } = drawing(c.doc!);
  const alpha = (d: EffectDrawing) =>
    d.layout.lines.flatMap((l) => l.clusters.map((c) => (c as EffectCluster).alpha));
  expect(alpha(data)[0]).toBe(0);
  p.step(0.6);
  const middle = alpha((drawFrame(p).nodes[0] as TextDrawNode).text as EffectDrawing);
  expect(middle[0]).toBe(1);
  expect(middle.at(-1)).toBe(0);
  p.step(0.6);
  expect(
    alpha((drawFrame(p).nodes[0] as TextDrawNode).text as EffectDrawing).every((a) => a === 1),
  ).toBe(true);
});
it('backgrounds bound all glyph advance intervals when tracking reverses their order', () => {
  const base = 'spec/conformance/text-background-negative-tracking/';
  const c = compile(readFileSync(base + 'case.animl', 'utf8'));
  expect(c.diagnostics).toEqual([]);
  const { data } = drawing(c.doc!);
  const expected = JSON.parse(readFileSync(base + 'effects.expected.json', 'utf8'));
  expect(data.backgrounds).toEqual(expected.backgrounds);
});

it('fitted backgrounds scale line metrics with advance intervals', () => {
  const dir = 'spec/conformance/text-background-fit/';
  const c = compile(readFileSync(dir + 'case.animl', 'utf8'));
  expect(c.diagnostics).toEqual([]);
  const { data } = drawing(c.doc!);
  // Fixed measurer: width 3, height 1 into a 1.5 x 0.5 box gives uniform scale 0.5.
  expect(data.layout.scale).toBe(0.5);
  const expected = JSON.parse(readFileSync(dir + 'effects.expected.json', 'utf8'));
  expect(data.backgrounds).toEqual(expected.backgrounds);
});
