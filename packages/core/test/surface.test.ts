import '@anima-format/core/all';
import { describe, it, expect } from 'vitest';
import { load, Player, drawFrame, toSVG } from '../src/index.ts';
import { compile, decompile } from '../../markup/src/index.ts';
import { destinations } from '../src/modules/surface/index.ts';
export const tile =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path fill="#ff0000" d="M0 0h4v8H0z"/><path fill="#0000ff" d="M4 0h4v8H4z"/></svg>',
  );
export const document = () => ({
  anima: '0.1',
  name: 'surface',
  grid: 24,
  requires: ['paint', 'assets', 'surface', 'composite'],
  assets: { tile: { type: 'image', source: tile, width: 8, height: 8 } },
  nodes: [
    {
      type: 'rect',
      id: 'r',
      x0: 4,
      y0: 4,
      w: 16,
      h: 16,
      fill: { type: 'image', asset: 'tile', imageWidth: 8, imageHeight: 8 },
    },
  ],
});
const player = (d: object) => {
  const result = load(d);
  expect(result.diagnostics).toEqual([]);
  return new Player(result.model!);
};
describe('surface', () => {
  it('image paints round trip through the structural AniML registry', () => {
    const d = document();
    expect(compile(decompile(d)).doc).toEqual(d);
    expect(decompile(d)).toContain('<imagePaint');
    expect(drawFrame(player(d)).nodes[0]!.paints[0]!.image).toMatchObject({
      source: tile,
      width: 8,
      height: 8,
      x: 0,
      y: 0,
      rotate: 0,
      scaleX: 1,
      scaleY: 1,
    });
    expect(toSVG(player(d))).toContain('<pattern');
  });
  it('modulation multiplies RGBA in sRGB', () => {
    const d = document();
    Object.assign(d.nodes[0]!.fill, { modulate: '#80ff0080' });
    const p = player(d),
      image = drawFrame(p).nodes[0]!.paints[0]!.image!;
    expect(image.modulate).toEqual([128 / 255, 1, 0, 128 / 255]);
    expect(toSVG(p)).toContain('color-interpolation-filters="sRGB"');
  });
  it.each([
    ['unknown-asset', '/nodes/0/fill/asset', { asset: 'missing' }],
    ['bad-color', '/nodes/0/fill/modulate', { modulate: 'oops' }],
    ['paint-conflict', '/nodes/0/fill', { color: '#fff' }],
    ['bad-value', '/nodes/0/fill', { imageScaleX: 0 }],
  ])('%s is precise and actionable', (code, pointer, change) => {
    const d = document();
    Object.assign(d.nodes[0]!.fill, change);
    expect(load(d).diagnostics).toContainEqual(
      expect.objectContaining({
        code,
        pointer,
        message: expect.any(String),
        hint: expect.any(String),
      }),
    );
  });
  it('rejects non-image asset types and undeclared assets', () => {
    const d = document();
    d.assets.tile.type = 'font';
    expect(load(d).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'asset-type', pointer: '/nodes/0/fill/asset' }),
    );
    d.requires = d.requires.filter((v) => v !== 'assets');
    delete (d as { assets?: unknown }).assets;
    expect(load(d).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'undeclared-feature', pointer: '/nodes/0/fill' }),
    );
  });
  it('supports image strokes and ordered image paints', () => {
    const d = document();
    Object.assign(d.nodes[0]!, {
      paints: [{ fill: d.nodes[0]!.fill }, { stroke: { ...d.nodes[0]!.fill, width: 2 } }],
    });
    delete (d.nodes[0] as { fill?: unknown }).fill;
    const svg = toSVG(player(d));
    expect(svg).toContain('as0-pattern-paints-0-fill');
    expect(svg).toContain('stroke="url(#as0-pattern-paints-1-stroke)"');
  });
  it('feathers paints independently and preserves disabled settings', () => {
    const d = document();
    Object.assign(d.nodes[0]!.fill, {
      feather: { inner: 2, outer: 3, offset: [1, -2], enabled: false },
    });
    const p = player(d);
    expect(drawFrame(p).nodes[0]!.paints[0]!.feather).toEqual({
      inner: 2,
      outer: 3,
      offset: [1, -2],
      enabled: false,
    });
    const svg = toSVG(p);
    expect(svg).toContain('filter="none"');
    expect(svg).toContain('stdDeviation="1"');
    expect(svg).toContain('operator="arithmetic"');
  });
  it('rejects malformed feather values', () => {
    const d = document();
    Object.assign(d.nodes[0]!.fill, { feather: { inner: -1 } });
    expect(load(d).diagnostics).toContainEqual(
      expect.objectContaining({ code: 'bad-value', pointer: '/nodes/0/fill/feather/inner' }),
    );
  });
  it('computes border preserving slices and proportionally collapses small targets', () => {
    expect(destinations([0, 2, 6, 8], 16)).toEqual([0, 2, 14, 16]);
    expect(destinations([0, 2, 6, 8], 2)).toEqual([0, 1, 1, 2]);
    expect(destinations([0, 1, 2, 6, 8], 16)).toEqual([0, 1, 3.6, 14, 16]);
  });
  it.each([
    ['slice-cuts', '/nodes/0/slice/x', { x: [0, 4, 4, 8] }],
    ['slice-modes', '/nodes/0/slice/modes', { modes: ['hidden'] }],
    ['slice-limit', '/nodes/0/slice/x', { x: Array.from({ length: 10 }, (_, i) => i) }],
    ['slice-bounds', '/nodes/0/slice', { x: [1, 2, 6, 8] }],
  ])('%s validates sliced images', (code, pointer, change) => {
    const d = document();
    Object.assign(d.nodes[0]!, {
      type: 'image',
      asset: 'tile',
      width: 16,
      height: 16,
      slice: { x: [0, 2, 6, 8], y: [0, 2, 6, 8], width: 16, height: 16, ...change },
    });
    for (const k of ['w', 'h', 'fill']) Reflect.deleteProperty(d.nodes[0]!, k);
    expect(load(d).diagnostics).toContainEqual(
      expect.objectContaining({ code, pointer, hint: expect.any(String) }),
    );
  });
});

// Browser-specific filtering is checked at the resolved draw-data boundary as well as in pixels.
it.each(['image', 'slice', 'feather'])('surface-%s draw conformance', async (feature) => {
  const { readFileSync } = await import('node:fs');
  const { runScript } = await import('../src/index.ts');
  const dir = new URL(`../../../spec/draw-conformance/surface-${feature}/`, import.meta.url);
  const result = runScript(
    load(readFileSync(new URL('case.ani', dir), 'utf8')).model!,
    readFileSync(new URL('script.txt', dir), 'utf8'),
  );
  expect(result.snapshots).toEqual(
    readFileSync(new URL('expected.jsonl', dir), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line)),
  );
  const data = drawFrame(result.player).nodes[0]!;
  expect(JSON.parse(JSON.stringify({ paints: data.paints, patches: data.patches }))).toEqual(
    JSON.parse(readFileSync(new URL('expected.draw.json', dir), 'utf8')),
  );
  if (feature === 'image') expect(data.paints[0]!.image!.x).toBe(4);
  if (feature === 'feather') expect(data.paints[0]!.feather!.outer).toBe(4.5);
  if (feature === 'slice')
    expect(data.patches![4]).toEqual({
      source: [2, 2, 4, 4],
      target: [6, 6, 12, 12],
      mode: 'hidden',
    });
});
it('SVG reports world feathering as unsupported-render with its source pointer', () => {
  const d = document();
  Object.assign(d.nodes[0]!.fill, { feather: { space: 'world', outer: 1 } });
  const p = new Player(load(d).model!);
  try {
    toSVG(p);
    throw new Error('expected unsupported-render');
  } catch (error) {
    expect(error).toMatchObject({
      code: 'unsupported-render',
      pointer: '/nodes/0/fill/feather/space',
      message: expect.any(String),
      hint: expect.any(String),
    });
  }
});
it('rejects slicing individual vector nodes with an actionable diagnostic', () => {
  const d = document();
  Object.assign(d.nodes[0]!, { slice: { x: [0, 8], y: [0, 8], width: 16, height: 16 } });
  expect(load(d).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'slice-type',
      pointer: '/nodes/0/slice',
      hint: expect.any(String),
    }),
  );
});
it('preserves feather fields as nested markup during decompilation', () => {
  const d = document();
  Object.assign(d.nodes[0]!.fill, { feather: { inner: 1 } });
  expect(decompile(d)).toContain('<feather inner="1"/>');
  expect(compile(decompile(d)).diagnostics).toEqual([]);
  expect(compile(decompile(d)).doc).toEqual(d);
});
