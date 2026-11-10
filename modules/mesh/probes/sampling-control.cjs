/* global require, console */
/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node probe scripts (CommonJS) */
const fs = require('fs'),
  { PNG } = require('pngjs');
const texture = PNG.sync.read(fs.readFileSync('modules/mesh/test/fixtures/flag.png'));
const tri = [
    [0, 1, 4],
    [0, 4, 3],
    [1, 2, 5],
    [1, 5, 4],
  ],
  uv = [
    [0, 0],
    [0.5, 0],
    [1, 0],
    [0, 1],
    [0.5, 1],
    [1, 1],
  ];
function dist(p, a, b) {
  let x = b[0] - a[0],
    y = b[1] - a[1],
    t = Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * y) / (x * x + y * y)));
  return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * y);
}
function coords(p, a, b, c) {
  let d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]),
    s = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / d,
    t = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / d;
  return [s, t, 1 - s - t];
}
function sample(u, v, mode) {
  let x = u * 8 - (mode === 'shifted' ? 0 : 0.5),
    y = v * 4 - (mode === 'shifted' ? 0 : 0.5),
    get = (x, y, c) =>
      texture.data[(Math.max(0, Math.min(3, y)) * 8 + Math.max(0, Math.min(7, x))) * 4 + c];
  if (mode === 'nearest') return [0, 1, 2].map((c) => get(Math.round(x), Math.round(y), c));
  let ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  return [0, 1, 2].map((c) =>
    Math.round(
      (1 - fy) * ((1 - fx) * get(ix, iy, c) + fx * get(ix + 1, iy, c)) +
        fy * ((1 - fx) * get(ix, iy + 1, c) + fx * get(ix + 1, iy + 1, c)),
    ),
  );
}
for (let [name, t] of [
  ['rigging-mesh', 0],
  ...['0', '0.25', '0.5', '1'].map((t) => ['rigging-mesh-animation', t]),
]) {
  let f = +t <= 0.5 ? +t * 2 : (1 - +t) * 2,
    p =
      name === 'rigging-mesh'
        ? [
            [24, 36],
            [72, 36],
            [120, 36],
            [24, 84],
            [72, 84],
            [120, 84],
          ]
        : [
            [24, 60],
            [72, 60],
            [120 - 6 * f, 60 - 21 * f],
            [24, 144],
            [72, 108],
            [120, 108],
          ];
  let root = `tests/oracle/${name}`,
    images = ['anima/' + t + '.png', 'rive/frames/' + t + '.png'].map((n) =>
      PNG.sync.read(fs.readFileSync(root + '/' + n)),
    );
  let stat = {};
  for (let image of ['anima', 'rive'])
    for (let mode of ['bilinear', 'shifted', 'nearest'])
      stat[image + '-' + mode] = { count: 0, over: 0, max: 0, sum: 0 };
  for (let y = 0; y < 240; y++)
    for (let x = 0; x < 240; x++) {
      let xy = [x + 0.5, y + 0.5];
      for (let indices of tri) {
        let v = indices.map((i) => p[i]),
          bc = coords(xy, ...v);
        if (bc.some((x) => x < 0) || v.some((a, i) => dist(xy, a, v[(i + 1) % 3]) <= 1)) continue;
        let u = bc.reduce((a, b, j) => a + b * uv[indices[j]][0], 0),
          w = bc.reduce((a, b, j) => a + b * uv[indices[j]][1], 0);
        for (let [ii, img] of images.entries())
          for (let mode of ['bilinear', 'shifted', 'nearest']) {
            let s = sample(u, w, mode),
              d = Math.max(...s.map((v, c) => Math.abs(v - img.data[(y * 240 + x) * 4 + c]))),
              q = stat[['anima', 'rive'][ii] + '-' + mode];
            q.count++;
            q.over += d > 16;
            q.max = Math.max(q.max, d);
            q.sum += d;
          }
        break;
      }
    }
  console.log(name, t, JSON.stringify(stat));
}
