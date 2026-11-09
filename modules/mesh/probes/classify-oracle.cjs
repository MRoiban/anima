/* global require, console */
/* eslint-disable @typescript-eslint/no-require-imports -- standalone Node probe scripts (CommonJS) */
const { PNG } = require('pngjs');
const fs = require('fs');
function dist(p, a, b) {
  let x = b[0] - a[0],
    y = b[1] - a[1],
    t = Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * y) / (x * x + y * y)));
  return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * y);
}
function inside(p, a, b, c) {
  let cross = (a, b) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  let z = [cross(a, b), cross(b, c), cross(c, a)];
  return z.every((x) => x >= 0) || z.every((x) => x <= 0);
}
const ts = [
    [0, 1, 4],
    [0, 4, 3],
    [1, 2, 5],
    [1, 5, 4],
  ],
  explicit = [
    [0, 1, 2],
    [0, 2, 3],
  ];
function geom(points, tri) {
  let edges = new Map();
  for (let t of tri)
    for (let i = 0; i < 3; i++) {
      let a = t[i],
        b = t[(i + 1) % 3],
        k = [a, b].sort((a, b) => a - b).join(',');
      let e = edges.get(k) || { a: points[a], b: points[b], n: 0 };
      e.n++;
      edges.set(k, e);
    }
  return { points, tri, edges: [...edges.values()] };
}
for (let [name, t] of [
  ['rigging-mesh', 0],
  ...['0', '0.25', '0.5', '1'].map((t) => ['rigging-mesh-animation', t]),
]) {
  let path = `tests/oracle/${name}`,
    diff = PNG.sync.read(fs.readFileSync(`${path}/anima/${t}-diff.png`)),
    a = PNG.sync.read(fs.readFileSync(`${path}/anima/${t}.png`)),
    r = PNG.sync.read(fs.readFileSync(`${path}/rive/frames/${t}.png`));
  let gs;
  if (name === 'rigging-mesh')
    gs = [
      geom(
        [
          [24, 36],
          [72, 36],
          [120, 36],
          [24, 84],
          [72, 84],
          [120, 84],
        ],
        ts,
      ),
      geom(
        [
          [24, 120],
          [120, 120],
          [120, 168],
          [24, 168],
        ],
        explicit,
      ),
    ];
  else {
    let f = t <= 0.5 ? t * 2 : (1 - t) * 2;
    gs = [
      geom(
        [
          [24, 60],
          [72, 60],
          [120 - 6 * f, 60 - 21 * f],
          [24, 144],
          [72, 108],
          [120, 108],
        ],
        ts,
      ),
    ];
  }
  let count = [0, 0, 0, 0],
    samples = [];
  for (let y = 0; y < 240; y++)
    for (let x = 0; x < 240; x++) {
      let i = (y * 240 + x) * 4,
        delta = Math.max(...[0, 1, 2, 3].map((k) => Math.abs(a.data[i + k] - r.data[i + k])));
      if (delta <= 16) continue;
      if (diff.data[i] !== delta) throw Error('diff mismatch');
      let p = [x + 0.5, y + 0.5],
        outer = gs.some((g) => g.edges.some((e) => e.n === 1 && dist(p, e.a, e.b) <= 1)),
        seam = gs.some((g) => g.edges.some((e) => e.n === 2 && dist(p, e.a, e.b) <= 1)),
        inner = gs.some((g) => g.tri.some((t) => inside(p, ...t.map((i) => g.points[i]))));
      let k = outer ? 1 : seam ? 0 : inner ? 2 : 3;
      count[k]++;
      if (k >= 2 && samples.length < 12)
        samples.push([x, y, delta, [...a.data.slice(i, i + 4)], [...r.data.slice(i, i + 4)]]);
    }
  console.log(name, t, count, JSON.stringify(samples));
}
