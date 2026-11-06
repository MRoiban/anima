import '@anima-format/core/all';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { run } from '../../../../packages/cli/src/index.ts';
import { sniff } from '../../../../packages/cli/src/asset-info.ts';
import { importSVG } from '../../../../packages/cli/src/import-svg.ts';
import { importLottie } from '../../../../packages/cli/src/import-lottie.ts';
import { compile } from '../../../../packages/markup/src/index.ts';
import { load, Player, drawFrame, toSVG } from '../../../../packages/core/src/index.ts';
import { Resvg } from '@resvg/resvg-js';
const dir = mkdtempSync(join(tmpdir(), 'anima-pipeline-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const png = new PNG({ width: 2, height: 1 });
png.data.set([255, 0, 0, 255, 0, 0, 255, 255]);
const bytes = PNG.sync.write(png);
writeFileSync(join(dir, 'self.png'), bytes);
const xml = (attrs = '', source = 'self.png') =>
  `<anima version="0.1" name="pipeline" grid="8" requires="assets paint"><asset name="photo" type="image" src="${source}" ${attrs}/><image id="photo" asset="photo" x0="0" y0="0" width="8" height="8" fit="resize"/></anima>`;
async function cli(...args: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const code = await run(args, { out: (s) => out.push(s), err: (s) => err.push(s) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}
it('sniffs a self-authored PNG and WAV/FLAC/MP3 containers, rejects truncation', () => {
  expect(sniff(bytes)).toEqual({ mime: 'image/png', width: 2, height: 1, size: bytes.length });
  const wav = Buffer.alloc(44 + 800);
  wav.write('RIFF');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(8000, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(800, 40);
  expect(sniff(wav)).toEqual({ mime: 'audio/wav', duration: 0.1, size: 844 });
  const flac = Buffer.alloc(42);
  flac.write('fLaC');
  flac[4] = 128;
  flac.writeUIntBE(34, 5, 3);
  flac.writeBigUInt64BE((8000n << 44n) | 800n, 18);
  expect(sniff(flac)).toEqual({ mime: 'audio/flac', duration: 0.1, size: 42 });
  const unknownLength = Buffer.from(flac);
  unknownLength.writeBigUInt64BE(8000n << 44n, 18);
  expect(sniff(unknownLength).duration).toBeUndefined();
  const mp3 = Buffer.alloc(417);
  mp3.set([255, 251, 144, 0]);
  expect(sniff(mp3).duration).toBeCloseTo(1152 / 44100, 12);
  for (const input of [
    bytes.subarray(0, 20),
    wav.subarray(0, 40),
    flac.subarray(0, 40),
    mp3.subarray(0, 400),
  ])
    expect(() => sniff(input)).toThrow();
  for (const [ext, data] of [
    ['wav', wav],
    ['flac', flac],
    ['mp3', mp3],
  ] as const)
    writeFileSync(join(dir, 'self.' + ext), data);
});
it('build embeds and validates audio metadata and source bytes, and excludes payloads with export=false', async () => {
  for (const ext of ['wav', 'flac', 'mp3']) {
    const file = join(dir, 'audio-' + ext + '.animl');
    writeFileSync(
      file,
      `<anima version="0.1" name="audio" grid="8" requires="assets"><asset name="tone" type="audio" src="self.${ext}" start="0" end="0.01"/><circle id="probe" cx="4" cy="4" r="1"/></anima>`,
    );
    const r = await cli('build', file, '--embed');
    expect(r.code, r.err).toBe(0);
    const a = JSON.parse(r.out).assets.tone;
    expect(a.source).toMatch(/^data:audio\//);
    expect(a.duration).toBeGreaterThan(0);
    expect(a.size).toBeGreaterThan(0);
  }
  const file = join(dir, 'excluded.animl');
  writeFileSync(file, xml('export="false"', 'not-present.png'));
  const r = await cli('build', file, '--embed');
  expect(r.code, r.err).toBe(0);
  expect(JSON.parse(r.out).assets.photo.source).toBe('not-present.png');
  const embedded = 'data:image/png;base64,' + bytes.toString('base64');
  writeFileSync(file, xml('export="false"', embedded));
  const excluded = await cli('build', file, '--embed');
  expect(excluded.code, excluded.err).toBe(0);
  expect(excluded.out).not.toContain(embedded);
  expect(JSON.parse(excluded.out).assets.photo).toMatchObject({
    source: 'anima:photo',
    storage: 'referenced',
  });
  writeFileSync(file, xml('export="false"', embedded.replace(/^data:/, 'DATA:')));
  const upper = await cli('build', file, '--embed');
  expect(upper.code, upper.err).toBe(0);
  expect(JSON.parse(upper.out).assets.photo.source).toBe('anima:photo');
});
it.each(['png', 'jpeg', 'webp'])(
  'encodes %s, updates MIME/byte size and decodes dimensions',
  async (encode) => {
    const file = join(dir, 'encode-' + encode + '.animl');
    writeFileSync(file, xml(`encode="${encode}" quality="0.8"`));
    const r = await cli('build', file);
    expect(r.code, r.err).toBe(0);
    const asset = JSON.parse(r.out).assets.photo;
    const output = Buffer.from(asset.source.split(',')[1], 'base64');
    const info = sniff(output);
    expect(info).toMatchObject({ mime: 'image/' + encode, width: 2, height: 1, size: asset.size });
    for (const ext of encode === 'jpeg' ? ['jpg', 'jpeg'] : [encode]) {
      writeFileSync(join(dir, 'encoded.' + ext), output);
      writeFileSync(file, xml('', 'encoded.' + ext));
      expect((await cli('build', file, '--embed')).code).toBe(0);
    }
  },
);
it('reports format mismatches, encoder unavailability, and clip bounds against inspected duration', async () => {
  writeFileSync(join(dir, 'wrong.jpg'), bytes);
  const file = join(dir, 'wrong.animl');
  writeFileSync(file, xml('', 'wrong.jpg'));
  const wrong = await cli('build', file, '--embed', '--format=json');
  expect(wrong.code).toBe(1);
  expect(JSON.parse(wrong.out).diagnostics).toContainEqual(
    expect.objectContaining({
      code: 'asset-format',
      pointer: '/assets/photo/source',
      message: expect.stringMatching(/./),
      hint: expect.stringMatching(/./),
    }),
  );
  const previous = process.env.CHROMIUM_PATH;
  process.env.CHROMIUM_PATH = join(dir, 'no-browser');
  try {
    writeFileSync(file, xml('encode="jpeg"'));
    const r = await cli('build', file, '--format=json');
    expect(r.code).toBe(1);
    expect(JSON.parse(r.out).diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'build-encoder-unavailable',
        pointer: '/assets/photo/encode',
        hint: expect.stringMatching(/CHROMIUM_PATH/),
      }),
    );
  } finally {
    if (previous === undefined) delete process.env.CHROMIUM_PATH;
    else process.env.CHROMIUM_PATH = previous;
  }
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><defs><linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="20" y2="0"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs><g transform="translate(2 1) rotate(0)"><path d="M0 0L12 0L12 12L0 12Z" fill="url(#ink)"/><circle cx="4" cy="4" r="2" fill="#ffffff" stroke="#000000" stroke-width="1"/></g></svg>`;
it('imports original SVG paths/groups/paints/gradients/transforms with pixel-identical rendering', async () => {
  const r = importSVG(svg, 'hand-svg');
  expect(r.diagnostics).toEqual([]);
  const model = load(r.doc);
  expect(model.diagnostics).toEqual([]);
  const original = PNG.sync.read(Buffer.from(new Resvg(svg).render().asPng()));
  const imported = PNG.sync.read(
    Buffer.from(new Resvg(toSVG(new Player(model.model!))).render().asPng()),
  );
  expect(imported.data).toEqual(original.data);
  const file = join(dir, 'hand.svg');
  writeFileSync(file, svg);
  const out = await cli('import', file);
  expect(out.code, out.err).toBe(0);
  expect(compile(out.out).diagnostics).toEqual([]);
  const unsupported = importSVG(
    svg.replace('<circle', '<filter id="f"/><circle filter="url(#f)"'),
    'warnings',
  );
  expect(unsupported.diagnostics.map((d) => d.pointer)).toContain('/svg/1/1');
  expect(unsupported.diagnostics.map((d) => d.pointer)).toContain('/svg/1/2/@filter');
});
const lottie = {
  v: '5.0',
  fr: 30,
  ip: 0,
  op: 30,
  w: 20,
  h: 20,
  layers: [
    {
      ty: 4,
      ks: {
        p: {
          a: 1,
          k: [
            { t: 0, s: [2, 4, 0], e: [10, 4, 0], o: { x: 0, y: 0 }, i: { x: 1, y: 1 } },
            { t: 30, s: [10, 4, 0] },
          ],
        },
        s: { a: 0, k: [100, 100, 100] },
        r: { a: 0, k: 0 },
        a: { a: 0, k: [0, 0, 0] },
        o: { a: 0, k: 100 },
      },
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'rc', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [4, 4] }, r: { a: 0, k: 0 } },
            { ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] }, o: { a: 0, k: 100 }, r: 1 },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
    },
  ],
};
it('imports a hand-authored Lottie group/shape/fill and independently checks its eased midpoint', async () => {
  const r = importLottie(JSON.stringify(lottie), 'hand-lottie');
  expect(r.diagnostics).toEqual([]);
  const model = load(r.doc);
  expect(model.diagnostics).toEqual([]);
  const p = new Player(model.model!);
  p.step(0.5);
  expect(drawFrame(p).nodes[0]!.transform[4]).toBeCloseTo(6, 7);
  const file = join(dir, 'hand.json');
  writeFileSync(file, JSON.stringify(lottie));
  const output = await cli('import', file);
  expect(output.code, output.err).toBe(0);
  expect(compile(output.out).diagnostics).toEqual([]);
  const bad = structuredClone(lottie) as typeof lottie & { effects: unknown[] };
  bad.effects = [{}];
  const warning = importLottie(JSON.stringify(bad), 'warning').diagnostics;
  expect(warning).toContainEqual(
    expect.objectContaining({
      code: 'import-unsupported',
      pointer: '/effects',
      severity: 'warning',
      hint: expect.stringMatching(/./),
    }),
  );
});

it('imports additional original SVG and Lottie trim inputs, and reports invalid import diagnostics', async () => {
  const fixture = (name: string) =>
    readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8');
  const vector = importSVG(fixture('transform.svg'), 'transform');
  expect(vector.diagnostics).toEqual([]);
  expect(load(vector.doc).model).toBeDefined();
  const trimmed = importLottie(fixture('trim.json'), 'trim');
  expect(trimmed.diagnostics).toEqual([]);
  const model = load(trimmed.doc);
  expect(model.diagnostics).toEqual([]);
  const player = new Player(model.model!);
  player.step(0.5);
  expect(drawFrame(player).nodes[1]!.paints[0]!.trim).toMatchObject({
    start: 0,
    end: 0.75,
    offset: 0,
  });
  const file = join(dir, 'invalid.json');
  writeFileSync(file, '{');
  const invalid = await cli('import', file, '--format=json');
  expect(invalid.code).toBe(1);
  expect(JSON.parse(invalid.out).diagnostics).toEqual([
    expect.objectContaining({
      code: 'import-invalid',
      pointer: '',
      message: expect.stringMatching(/./),
      hint: expect.stringMatching(/./),
    }),
  ]);
});

it('preserves earlier GIF, SVG and opaque font embedding without new decoders', async () => {
  const gif = Buffer.from(
    '47494638396101000100800000000000ffffff2c00000000010001000002024401003b',
    'hex',
  );
  for (const [ext, type, bytes, mime] of [
    ['gif', 'image', gif, 'image/gif'],
    [
      'svg',
      'image',
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>',
      ),
      'image/svg+xml',
    ],
    ['woff', 'font', Buffer.from([0, 1, 2, 3]), 'font/woff'],
  ] as const) {
    writeFileSync(join(dir, 'legacy.' + ext), bytes);
    const file = join(dir, 'legacy-' + ext + '.animl');
    writeFileSync(
      file,
      `<anima version="0.1" name="legacy" grid="8" requires="assets"><asset name="legacy" type="${type}" src="legacy.${ext}"/><circle id="probe" cx="4" cy="4" r="1"/></anima>`,
    );
    const result = await cli('build', file, '--embed');
    expect(result.code, result.err).toBe(0);
    expect(JSON.parse(result.out).assets.legacy.source).toBe(
      `data:${mime};base64,${bytes.toString('base64')}`,
    );
  }
});

it('translates SVG RGB/alpha colours and warns for unsupported descriptive/paint values', () => {
  const source =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><title>Original</title><rect x="1px" y="1" width="6" height="6" fill="rgba(255, 0, 0, 0.5)" stroke="hsl(0 100% 50%)"/><circle cx="2px" cy="2px" r="1px" fill="RED"/></svg>';
  const result = importSVG(source, 'colours');
  expect(load(result.doc).model).toBeDefined();
  const node = result.doc.nodes[0].children[0];
  expect(node.fill.color).toBe('#ff000080');
  expect(node.x0).toBe(1);
  expect(result.doc.nodes[0].children[1]).toMatchObject({
    center: [2, 2],
    r: 1,
    fill: { color: '#ff0000' },
  });
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'import-unsupported',
        pointer: '/svg/0',
        message: expect.stringMatching(/metadata/),
        hint: expect.stringMatching(/./),
      }),
      expect.objectContaining({
        code: 'import-unsupported',
        pointer: '/svg/1/@stroke',
        message: expect.stringMatching(/colour/),
        hint: expect.stringMatching(/./),
      }),
    ]),
  );
});
