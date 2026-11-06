import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import {
  load,
  Player,
  toSVG,
  drawFrame,
  registerSVGBackend,
} from '../../../../packages/core/src/index.ts';
import { paintSVG, paintSVGBase } from '../../../paint/core/svg.ts';
import { compile, decompile, formatMarkup } from '../../../../packages/markup/src/index.ts';

const xml = `<anima version="0.1" name="assets-pipeline" grid="12" requires="assets paint events">
<asset name="photo" type="image" src="photo.png" encode="webp" quality="0.8" export="false" size="12" mime="image/png" metadata='{&quot;credit&quot;:&quot;self&quot;}'/>
<asset name="tone" type="audio" src="tone.wav" start="0.2" end="0.9" duration="1"/>
<asset name="bytes" type="blob" src="data:application/octet-stream;base64,AQID"/>
<image id="photo" asset="photo" x0="0" y0="0" width="12" height="12" fit="resize" sampling="nearest" wrap-x="mirror" wrap-y="repeat"/>
<event-def name="ping" audio="tone"/>
<layer name="main" initial="idle"><state name="idle" emit="ping"><pose/></state></layer>
</anima>`;
it('compiles both spellings and preserves loader metadata, clips and build options on roundtrip', () => {
  const r = compile(xml);
  expect(r.diagnostics).toEqual([]);
  expect(compile(decompile(r.doc!)).doc).toEqual(r.doc);
  const doc = r.doc as { assets: Record<string, unknown>; nodes: unknown[] };
  expect(doc.assets.photo).toMatchObject({
    type: 'image',
    encode: 'webp',
    quality: 0.8,
    export: false,
    size: 12,
    mime: 'image/png',
    metadata: { credit: 'self' },
  });
  expect(doc.nodes[0]).toMatchObject({ fit: 'resize', wrapX: 'mirror', wrapY: 'repeat' });
  const player = new Player(load(r.doc!).model!);
  expect(drawFrame(player).nodes[0]!.geometry!.image).toMatchObject({
    wrapX: 'mirror',
    wrapY: 'repeat',
  });
  const svg = toSVG(player);
  expect(svg).toContain('<pattern');
  expect(svg).toContain('matrix(-1 0 0 1 24 0)');
});
it.each([
  ['start="0.2" end="0.9"', 'start="0.9" end="0.2"', 'asset-clip', '/assets/tone/end'],
  ['start="0.2" end="0.9"', 'start="1.2" end="1.4"', 'asset-clip', '/assets/tone/start'],
  ['type="audio"', 'type="blob"', 'asset-option', '/assets/tone/start'],
  [' encode="webp"', '', 'asset-option', '/assets/photo/quality'],
])('reports complete diagnostics for invalid asset options (%s)', (from, to, code, pointer) => {
  const diagnostics = compile(xml.replace(from, to)).diagnostics;
  expect(diagnostics).toContainEqual(
    expect.objectContaining({
      code,
      pointer,
      message: expect.stringMatching(/./),
      hint: expect.stringMatching(/./),
    }),
  );
});

it('declines unregistered browser wrapping with a complete import diagnostic', () => {
  const player = new Player(load(compile(xml).doc!).model!);
  registerSVGBackend('paint', paintSVGBase);
  try {
    expect(() => toSVG(player)).toThrow(
      expect.objectContaining({
        code: 'unsupported-render',
        pointer: '/nodes/0',
        message: expect.stringMatching(/sampling/),
        hint: 'import @anima-format/web/paint-sampling',
      }),
    );
  } finally {
    registerSVGBackend('paint', paintSVG);
  }
});

it('declines SVG bilinear repeat with the measured interpolation reason', () => {
  const player = new Player(
    load(compile(xml.replace('sampling="nearest"', 'sampling="bilinear"')).doc!).model!,
  );
  expect(() => toSVG(player)).toThrow(
    expect.objectContaining({
      code: 'unsupported-render',
      pointer: '/nodes/0/wrapY',
      message: expect.stringMatching(/texture edges/),
      hint: expect.stringMatching(/188/),
    }),
  );
});

it('keeps all 37 capability examples compiled and canonically formatted', () => {
  const examples = globSync([
    'modules/assets/capabilities/*/example.animl',
    'modules/paint/capabilities/drawing-paint-image-*/example.animl',
  ]);
  expect(examples).toHaveLength(37);
  for (const file of examples) {
    const source = readFileSync(file, 'utf8'),
      result = compile(source);
    expect(result.diagnostics, file).toEqual([]);
    expect(result.text, file).toBe(readFileSync(file.replace(/\.animl$/, '.ani'), 'utf8'));
    expect(formatMarkup(source).text, file).toBe(source);
  }
});
