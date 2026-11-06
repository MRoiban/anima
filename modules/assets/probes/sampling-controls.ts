import { format, resolveConfig } from 'prettier';
// Render independently inspected native UV geometry and native 1:1 decoded texels
// through Anima's renderer. Original oracle inputs/thresholds are untouched.
import '@anima-format/core/all';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { PNG } from 'pngjs';
import { compare } from '../../../tools/oracle.ts';
import { load, Player, toSVG } from '../../../packages/core/src/index.ts';
import { toPNG } from '../../../packages/cli/src/render.ts';

type Native = { type: string; children?: Native[]; [key: string]: unknown };
function flatten(value: unknown): Native[] {
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (!value || typeof value !== 'object') return [];
  const n = value as Native;
  return [n, ...Object.values(n).flatMap(flatten)];
}
function metric(a: Buffer, b: Buffer) {
  const { diff, ...result } = compare(a, b, 16);
  void diff;
  return result;
}
const results = [];
for (const suffix of ['filter-bilinear', 'import-jpeg', 'import-jpg']) {
  const name = 'assets-image-' + suffix;
  const base = 'tests/oracle/' + name + '/';
  const inspected = JSON.parse(
    execFileSync(homedir() + '/.rive/bin/rive', ['inspect', base + 'rive'], { encoding: 'utf8' }),
  );
  const data = flatten(inspected);
  const vertices = data
    .filter((n) => n.type === 'ContourMeshVertex')
    .map(({ x, y, u, v }) => ({ x, y, u, v }));
  const asset = data.find((n) => n.type === 'ImageAsset')!;
  const mesh = data.find((n) => n.type === 'Mesh')!;
  // This control is intentionally restricted to the observed full affine rectangle.
  if (
    JSON.stringify(vertices) !==
    JSON.stringify([
      { x: 0, y: 0, u: 0, v: 0 },
      { x: 240, y: 0, u: 1, v: 0 },
      { x: 240, y: 240, u: 1, v: 1 },
      { x: 0, y: 240, u: 0, v: 1 },
    ])
  )
    throw Error('native UV geometry changed');
  const doc = JSON.parse(readFileSync(base + 'case.ani', 'utf8'));
  const declaration = doc.assets.tile;
  const source = Buffer.from(declaration.source.split(',')[1], 'base64');
  const ext = suffix === 'filter-bilinear' ? 'png' : suffix.slice(7);
  const nativeSource = readFileSync(base + 'rive/tile.' + ext);
  if (!source.equals(nativeSource)) throw Error('control source bytes differ');
  const actual = toPNG(
    toSVG(new Player(load(doc).model!), { width: 240, height: 240, background: '#ffffff' }),
    240,
  );
  // Derive a standalone SVG from inspected UVs, source bytes and sampler fields;
  // this bypasses all Anima image geometry/fitting/sampling code.
  const uri = `data:${declaration.mime ?? (ext === 'png' ? 'image/png' : 'image/jpeg')};base64,${source.toString('base64')}`;
  const svg = (uri: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="white"/><image href="${uri}" x="${vertices[0]!.x}" y="${vertices[0]!.y}" width="${Number(vertices[1]!.x) - Number(vertices[0]!.x)}" height="${Number(vertices[3]!.y) - Number(vertices[0]!.y)}" preserveAspectRatio="none" image-rendering="${asset.samplerFilter === 1 ? 'pixelated' : 'auto'}"/></svg>`;
  const control = toPNG(svg(uri), 240);
  const native = readFileSync(base + 'rive/frames/0.png');
  const common = {
    name,
    vertices,
    triangles: mesh.rig,
    sampler: { filter: asset.samplerFilter, wrapX: asset.samplerWrapX, wrapY: asset.samplerWrapY },
    sha256: createHash('sha256').update(source).digest('hex'),
    sameRendererNativeGeometry: metric(actual, control),
    originalNative: metric(actual, native),
  };
  if (ext !== 'png') {
    const decoded = readFileSync('modules/assets/probes/native-data/' + ext + '/decoded.png');
    const pixels = PNG.sync.read(decoded);
    if (pixels.width !== 2 || pixels.height !== 2) throw Error('not intrinsic decode');
    // Native decoded pixels are fed to exactly the same image geometry/renderer.
    declaration.source = 'data:image/png;base64,' + decoded.toString('base64');
    const nativeDataRenderedByAnima = toPNG(
      toSVG(new Player(load(doc).model!), { width: 240, height: 240, background: '#ffffff' }),
      240,
    );
    results.push({
      ...common,
      nativeDecodedRGBA: Array.from(pixels.data),
      nativeDataRenderedByAnima: metric(nativeDataRenderedByAnima, native),
    });
  } else {
    // Independently compute an ideal clamped bilinear shader at pixel centres.
    const pixels = PNG.sync.read(source),
      ideal = new PNG({ width: 240, height: 240 });
    for (let y = 0; y < 240; y++)
      for (let x = 0; x < 240; x++) {
        const u = Math.max(0, Math.min(1, (x + 0.5) / 120 - 0.5));
        const v = Math.max(0, Math.min(1, (y + 0.5) / 120 - 0.5));
        for (let c = 0; c < 4; c++)
          ideal.data[(y * 240 + x) * 4 + c] = Math.round(
            pixels.data[c]! * (1 - u) * (1 - v) +
              pixels.data[4 + c]! * u * (1 - v) +
              pixels.data[8 + c]! * (1 - u) * v +
              pixels.data[12 + c]! * u * v,
          );
      }
    const reference = PNG.sync.write(ideal);
    results.push({
      ...common,
      idealBilinearVsNative: metric(reference, native),
      idealBilinearVsResvg: metric(reference, actual),
    });
  }
}
writeFileSync(
  'modules/assets/probes/sampling-controls.json',
  await format(JSON.stringify(results), {
    ...(await resolveConfig('modules/assets/probes/sampling-controls.json')),
    parser: 'json',
  }),
);
console.log(JSON.stringify(results, null, 2));
