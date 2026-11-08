import '@anima-format/core/all';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { run } from '../../../../packages/cli/src/index.ts';
import { importSVG } from '../../../../packages/cli/src/import-svg.ts';
import { importLottie } from '../../../../packages/cli/src/import-lottie.ts';
import { load } from '../../../../packages/core/src/index.ts';

const dir = mkdtempSync(join(tmpdir(), 'anima-rottweiler-p5-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// R2-03: imported ellipses use the painted ellipse's cx/cy fields.
it('imports SVG and Lottie ellipses as loadable ellipse nodes', () => {
  const svg = importSVG(
    '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="10" rx="8" ry="4"/></svg>',
    'ellipse',
  );
  const lottie = importLottie(
    JSON.stringify({
      fr: 30,
      ip: 0,
      op: 30,
      w: 24,
      h: 24,
      layers: [
        {
          ty: 4,
          shapes: [
            { ty: 'el', p: { a: 0, k: [12, 10] }, s: { a: 0, k: [16, 8] } },
            { ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] } },
          ],
        },
      ],
    }),
    'ellipse',
  );
  for (const result of [svg, lottie]) {
    expect(result.diagnostics).toEqual([]);
    expect(load(result.doc).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(JSON.stringify(result.doc)).toContain('"cx":12,"cy":10,"rx":8,"ry":4');
  }
});

// R2-06: `anima render` embeds and decodes component-local image catalogs too.
it('renders component-local image assets', async () => {
  writeFileSync(
    join(dir, 'pic.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>',
  );
  const file = join(dir, 'local.ani');
  writeFileSync(
    file,
    JSON.stringify({
      anima: '0.1',
      name: 'local',
      grid: 24,
      requires: ['components', 'paint', 'assets'],
      components: {
        tile: {
          grid: 24,
          assets: { pic: { type: 'image', source: 'pic.svg', width: 2, height: 2 } },
          nodes: [{ id: 'im', type: 'image', asset: 'pic', x0: 0, y0: 0, width: 24, height: 24 }],
        },
      },
      nodes: [{ id: 'tile', type: 'instance', component: 'tile' }],
    }),
  );
  const out = join(dir, 'local.png');
  const io = { out: () => {}, err: () => {} };
  expect(await run(['render', file, '--size=8', '-o', out], io)).toBe(0);
  const pixels = PNG.sync.read(readFileSync(out));
  expect([...pixels.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
});

// R4-05: a data:image/svg+xml label does not exempt non-SVG bytes from the image-kind check.
it('rejects image assets whose SVG-labelled data is not SVG', async () => {
  const { buildAssets } = await import('../../../../packages/cli/src/build-assets.ts');
  const wav = Buffer.alloc(46);
  wav.write('RIFF');
  wav.writeUInt32LE(38, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(2, 40);
  for (const source of [
    'data:image/svg+xml,This%20is%20not%20an%20SVG',
    'data:image/svg+xml;base64,' + wav.toString('base64'),
  ])
    expect(
      await buildAssets({ assets: { bad: { type: 'image', source } } }, join(dir, 'x.ani'), true),
    ).toEqual([expect.objectContaining({ code: 'asset-format' })]);
  // A genuine SVG keeps building.
  const svg =
    'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>');
  expect(
    await buildAssets({ assets: { ok: { type: 'image', source: svg } } }, join(dir, 'y.ani'), true),
  ).toEqual([]);
});
