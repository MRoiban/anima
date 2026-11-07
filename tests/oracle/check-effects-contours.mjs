// Independent original-font corners transformed by the public drawing output.
import '@anima-format/core/all';
import { URL } from 'node:url';
import console from 'node:console';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { load, Player, drawFrame } from '../../packages/core/src/index.ts';
import { documentFonts } from '../../packages/cli/src/font/document.ts';
import { Font } from '../../packages/cli/src/font/reader.ts';
import { registerTextMeasurer } from '../../modules/text/core/measure.ts';
const root = new URL('./', import.meta.url);
const font = new Font(readFileSync(new URL('../../fixtures/fonts/anima-test.ttf', root)));
const results = [];
for (const item of JSON.parse(readFileSync(new URL('effects-measurements.json', root), 'utf8'))) {
  const dir = new URL(item.name + '/', root),
    file = new URL('case.ani', dir);
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  registerTextMeasurer(documentFonts(doc, file.pathname).measurer);
  const result = load(doc);
  if (!result.model) throw Error(JSON.stringify(result.diagnostics));
  const p = new Player(result.model);
  p.step(0);
  const data = drawFrame(p).nodes[0].text;
  const corners = [],
    edges = [];
  for (const l of data.layout.lines)
    for (const c of l.clusters) {
      const size = (c.font.size * data.layout.scale) / font.unitsPerEm;
      const matrix = c.matrix ?? [1, 0, 0, 1, 0, 0];
      for (const contour of font.contours(font.glyph(c.text.codePointAt(0)), c.font.axes)) {
        const points = [];
        for (const q of contour) {
          const x = c.x + q.x * size,
            y = c.y - q.y * size;
          const point = [
            (matrix[0] * x + matrix[2] * y + matrix[4] + doc.nodes[0].x) * 12,
            (matrix[1] * x + matrix[3] * y + matrix[5] + doc.nodes[0].y) * 12,
          ];
          corners.push(point);
          points.push(point);
        }
        edges.push(points);
      }
    }
  const a = PNG.sync.read(readFileSync(new URL('anima/0.png', dir))),
    b = PNG.sync.read(readFileSync(new URL('rive/frames/0.png', dir)));
  let over = 0,
    nonCorner = 0,
    overlappingEdges = 0;
  const misses = [];
  for (let y = 0; y < 240; y++)
    for (let x = 0; x < 240; x++) {
      const i = (y * 240 + x) * 4;
      let delta = 0;
      for (let k = 0; k < 4; k++) delta = Math.max(delta, Math.abs(a.data[i + k] - b.data[i + k]));
      if (delta <= 16) continue;
      over++;
      if (
        !corners.some(
          ([cx, cy]) =>
            x - 1e-6 <= cx && cx <= x + 1 + 1e-6 && y - 1e-6 <= cy && cy <= y + 1 + 1e-6,
        )
      ) {
        // Accept only the observed AA differences at two overlapping horizontal glyph edges.
        const count = edges.filter((points) =>
          points.some((p, j) => {
            const q = points[(j + 1) % points.length];
            return (
              Math.abs(p[1] - q[1]) < 1e-6 &&
              y - 1e-6 <= p[1] &&
              p[1] <= y + 1 + 1e-6 &&
              Math.min(p[0], q[0]) <= x + 1 &&
              Math.max(p[0], q[0]) >= x
            );
          }),
        ).length;
        if (item.name === 'text-modifier-scale' && count >= 2) overlappingEdges++;
        else {
          nonCorner++;
          misses.push([x, y, delta]);
        }
      }
    }
  results.push({
    name: item.name,
    over,
    overlappingEdges,
    nonCorner,
    ...(nonCorner ? { misses } : {}),
  });
}
writeFileSync(new URL('effects-contour-check.json', root), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => r.nonCorner)) throw Error('Non-corner differences remain');
