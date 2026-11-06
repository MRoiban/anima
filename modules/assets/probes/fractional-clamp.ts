// Extra adversarial observation: same native UV mesh, independently decomposed
// into SVG clamp rectangles. This probe does not change an oracle threshold.
import '@anima-format/core/all';
import { execFileSync, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { format, resolveConfig } from 'prettier';
import { compile } from '../../../packages/markup/src/index.ts';
import { load, Player, toSVG } from '../../../packages/core/src/index.ts';
import { toPNG } from '../../../packages/cli/src/render.ts';
import { compare } from '../../../tools/oracle.ts';
const dir = 'modules/assets/probes/fractional-clamp';
mkdirSync(dir, { recursive: true });
const rive = homedir() + '/.rive/bin/rive';
const doc = JSON.parse(
  readFileSync('tests/oracle/drawing-paint-image-wrap-clamp/case.ani', 'utf8'),
);
Object.assign(doc.nodes[0], { width: 8.12, height: 8.12, align: 'center' });
const bytes = Buffer.from(doc.assets.tile.source.split(',')[1], 'base64');
if (process.argv.includes('--capture')) {
  writeFileSync(dir + '/tile.png', bytes);
  writeFileSync(
    dir + '/rive.yaml',
    'name: p5b7-fractional-clamp\nlogs:\n  file: build/rive.log\n  problems: build/problems.log\n',
  );
  writeFileSync(dir + '/commands.txt', 'screenshot native.png\n');
  writeFileSync(
    dir + '/scene.rml',
    '<Rive version="1" kind="fragment"><Artboard name="Clamp" id="0:1" width="240" height="240" styleId="0:2"><LayoutComponentStyle id="0:2"/><Fill><SolidColor colorValue="FFFFFFFF"/></Fill><Image assetId="0:60" originX="0" originY="0"><Mesh triangleIndexBytes="AAECAAID"><ContourMeshVertex x="0" y="0" u="-1.53" v="-1.53"/><ContourMeshVertex x="243.6" y="0" u="2.53" v="-1.53"/><ContourMeshVertex x="243.6" y="243.6" u="2.53" v="2.53"/><ContourMeshVertex x="0" y="243.6" u="-1.53" v="2.53"/></Mesh></Image></Artboard><ImageAsset file="tile.png" name="tile" id="0:60" samplerFilter="1" samplerWrapX="0" samplerWrapY="0"/></Rive>\n',
  );
  const capture = spawnSync(rive, ['.', '--commands=commands.txt'], {
    cwd: resolve(dir),
    encoding: 'utf8',
  });
  if (capture.status) throw Error(capture.stderr);
  writeFileSync(dir + '/session.txt', (capture.stdout + capture.stderr).trimEnd() + '\n');
}
const inspected = JSON.parse(execFileSync(rive, ['inspect', dir], { encoding: 'utf8' }));
const nodes: Record<string, unknown>[] = [];
function walk(value: unknown) {
  if (Array.isArray(value)) value.forEach(walk);
  else if (value && typeof value === 'object') {
    nodes.push(value as Record<string, unknown>);
    Object.values(value).forEach(walk);
  }
}
walk(inspected);
const vertices = nodes
  .filter((n) => n.type === 'ContourMeshVertex')
  .map(({ x, y, u, v }) => ({ x: Number(x), y: Number(y), u: Number(u), v: Number(v) }));
const w = vertices[1]!.x,
  h = vertices[3]!.y;
const iw = w / (vertices[1]!.u - vertices[0]!.u),
  ih = h / (vertices[3]!.v - vertices[0]!.v);
const x = -vertices[0]!.u * iw,
  y = -vertices[0]!.v * ih;
const axes = (size: number, pos: number, image: number) => [
  [0, pos, 0, image / 2],
  [pos, image, 0, image],
  [pos + image, size - pos - image, image / 2, image / 2],
];
function geometrySVG(
  w: number,
  h: number,
  iw: number,
  ih: number,
  x: number,
  y: number,
  factor = 30,
) {
  // Express native pixel coordinates in the same 8-unit viewport as Anima;
  // this keeps the rasterizer's transform/ceil path identical, without changing
  // the native positions or UVs (240/8 = 30 exactly).
  w /= factor;
  h /= factor;
  iw /= factor;
  ih /= factor;
  x /= factor;
  y /= factor;
  const cells = [];
  for (const [dy, dh, sy, sh] of axes(h, y, ih))
    for (const [dx, dw, sx, sw] of axes(w, x, iw))
      cells.push(
        `<svg x="${dx}" y="${dy}" width="${dw}" height="${dh}" viewBox="${sx} ${sy} ${sw} ${sh}" style="width:${dw}px;height:${dh}px;overflow:hidden" preserveAspectRatio="none" overflow="hidden"><image width="${iw}" height="${ih}" href="${doc.assets.tile.source}" preserveAspectRatio="none" image-rendering="pixelated"/></svg>`,
      );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="240" height="240"><defs><pattern id="tile" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${cells.join('')}</pattern></defs><rect width="8" height="8" fill="white"/><rect width="${w}" height="${h}" fill="url(#tile)"/></svg>`;
}
const svg = geometrySVG(w, h, iw, ih, x, y);
const actual = toPNG(
  toSVG(new Player(load(doc).model!), { width: 240, height: 240, background: '#ffffff' }),
  240,
);
const control = toPNG(svg, 240),
  native = readFileSync(dir + '/native.png');
// A second control uses Rive's exact authored decimal UV mesh. Rational
// arithmetic avoids a spurious ceil(60.00000000000001) offscreen image size.
const rml = readFileSync(dir + '/scene.rml', 'utf8');
if (!rml.includes('x="243.6" y="243.6" u="2.53" v="2.53"') || !rml.includes('u="-1.53" v="-1.53"'))
  throw Error('authored mesh changed');
const authoredImage = (2436 * 100) / (10 * (253 + 153));
const authored = toPNG(
  geometrySVG(
    2436 / (10 * 30),
    2436 / (10 * 30),
    (2436 * 100) / (10 * (253 + 153) * 30),
    (2436 * 100) / (10 * (253 + 153) * 30),
    (153 * authoredImage) / (100 * 30),
    (153 * authoredImage) / (100 * 30),
    1,
  ),
  240,
);
const metric = (a: Buffer, b: Buffer) => {
  const { diff, ...m } = compare(a, b, 16);
  void diff;
  return m;
};
// Classify, without excluding anything from the full comparison above.
const a = PNG.sync.read(actual),
  b = PNG.sync.read(native);
const edgeX = [Math.floor(x), Math.floor(x + iw)],
  edgeY = [Math.floor(y), Math.floor(y + ih)];
let over16OutsideSliceEdges = 0,
  maxOutsideSliceEdges = 0;
for (let py = 0; py < 240; py++)
  for (let px = 0; px < 240; px++) {
    const offset = (py * 240 + px) * 4;
    const delta = Math.max(
      ...[0, 1, 2, 3].map((c) => Math.abs(a.data[offset + c]! - b.data[offset + c]!)),
    );
    if (!edgeX.includes(px) && !edgeY.includes(py)) {
      maxOutsideSliceEdges = Math.max(maxOutsideSliceEdges, delta);
      if (delta > 16) over16OutsideSliceEdges++;
    }
  }
const result = {
  vertices,
  coverageClassification: { edgeX, edgeY, over16OutsideSliceEdges, maxOutsideSliceEdges },
  derived: { w, h, iw, ih, x, y },
  sameRendererNativeData: metric(actual, control),
  authoredControl: metric(actual, authored),
  native: metric(actual, native),
  note: 'Fractional SVG slice-coverage finding; unchanged threshold 16 and max2/zero-over remain failing. Canvas has separate all-pixel ideal-shader tests. This is not a passing SVG parity claim.',
};
writeFileSync(dir + '/anima.png', actual);
writeFileSync(dir + '/native-data-svg.png', control);
writeFileSync(dir + '/authored-native-data-svg.png', authored);
writeFileSync(
  dir + '/measurements.json',
  await format(JSON.stringify(result), {
    ...(await resolveConfig(dir + '/measurements.json')),
    parser: 'json',
  }),
);
// Register this additional measured raster finding, never as a passing case.
const oracle = 'tests/oracle/assets-clamp-fractional-finding';
mkdirSync(oracle + '/rive/frames', { recursive: true });
for (const file of ['scene.rml', 'commands.txt', 'rive.yaml', 'session.txt', 'tile.png'])
  copyFileSync(dir + '/' + file, oracle + '/rive/' + file);
copyFileSync(dir + '/native.png', oracle + '/rive/frames/0.png');
// The capture command has a project-local output filename in the recorded session.
const source = readFileSync('tests/oracle/drawing-paint-image-wrap-clamp/case.animl', 'utf8')
  .replace('name="drawing-paint-image-wrap-clamp"', 'name="assets-clamp-fractional-finding"')
  .replace('align="top-left"', 'align="center"')
  .replace('width="8" height="8"', 'width="8.12" height="8.12"');
const built = compile(source);
if (built.diagnostics.length || !built.text) throw Error('fractional source invalid');
writeFileSync(oracle + '/case.animl', source);
writeFileSync(oracle + '/case.ani', built.text);
const finding = {
  status: 'finding',
  reason: `Fractional nearest SVG clamp: max ${result.native.maxDiff}, ${result.native.over}/57600 pixels above16. Native UV mesh independently rendered through resvg equals Anima max${result.sameRendererNativeData.maxDiff}; exact authored-decimal control max${result.authoredControl.maxDiff}. Raster slice-coverage difference retained, no threshold change. See modules/assets/probes/fractional-clamp.ts and fractional-clamp/measurements.json.`,
  case: {
    name: 'assets-clamp-fractional-finding',
    times: [0],
    threshold: 16,
    maxDiff: 2,
    maxOverPercent: 0,
  },
};
writeFileSync(
  oracle + '/finding.json',
  await format(JSON.stringify(finding), {
    ...(await resolveConfig(oracle + '/finding.json')),
    parser: 'json',
  }),
);
console.log(result);
