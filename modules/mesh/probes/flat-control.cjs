/* global require, console */
/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node probe scripts (CommonJS) */
// The static meshes are both affine rectangles. Render the same image without
// triangle clipping to isolate the effect of per-triangle rasterization.
const { Resvg } = require('@resvg/resvg-js');
const { PNG } = require('pngjs');
const fs = require('fs');
const texture = fs.readFileSync('modules/mesh/test/fixtures/flag.png').toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="white"/><image href="data:image/png;base64,${texture}" x="24" y="36" width="96" height="48"/><image href="data:image/png;base64,${texture}" x="24" y="120" width="96" height="48"/></svg>`;
const actual = PNG.sync.read(new Resvg(svg).render().asPng());
const native = PNG.sync.read(fs.readFileSync('tests/oracle/rigging-mesh/rive/frames/0.png'));
let max = 0,
  over = 0;
for (let i = 0; i < actual.data.length; i += 4) {
  const delta = Math.max(
    ...[0, 1, 2, 3].map((channel) => Math.abs(actual.data[i + channel] - native.data[i + channel])),
  );
  max = Math.max(max, delta);
  over += Number(delta > 16);
}
console.log({ max, over });
