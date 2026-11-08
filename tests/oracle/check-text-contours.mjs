// Original-font rectangle controls: every over-threshold difference must touch a glyph corner.
import '@anima-format/core/all';
import { URL } from 'node:url';
import console from 'node:console';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { load, runScript } from '../../packages/core/src/index.ts';
import { documentFonts } from '../../packages/cli/src/font/document.ts';
import { Font } from '../../packages/cli/src/font/reader.ts';
import { registerTextMeasurer } from '../../modules/text/core/measure.ts';
import { textLayout } from '../../modules/text/core/index.ts';

const root = new URL('./', import.meta.url);
const font = new Font(readFileSync(new URL('../../fixtures/fonts/anima-test.ttf', root)));
const measured = JSON.parse(readFileSync(new URL('text-measurements.json', root), 'utf8'));
const controls = new Set(
  [...measured.explicitLeading, ...measured.additionalSamples]
    .map((c) => c.name)
    .concat('assets-font-formats'),
);
const cases = JSON.parse(readFileSync(new URL('cases.json', root), 'utf8')).filter((c) =>
  controls.has(c.name),
);
const results = [];
for (const c of cases) {
  const dir = new URL(c.name + '/', root);
  const file = new URL('case.ani', dir);
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  registerTextMeasurer(documentFonts(doc, file.pathname).measurer);
  const result = load(doc);
  if (!result.model) throw Error(JSON.stringify(result.diagnostics));
  for (const time of c.times) {
    const { player } = runScript(result.model, c.scripts?.[String(time)] ?? `advance ${time}`);
    player.step(0);
    const layout = textLayout(player, 0);
    const corners = [];
    for (const line of layout.lines)
      for (const cluster of line.clusters) {
        const scale = (cluster.font.size * layout.scale * 12) / font.unitsPerEm;
        const x = (cluster.x + (doc.nodes[0].x ?? 0)) * 12;
        const y = (cluster.y + (doc.nodes[0].y ?? 0)) * 12;
        for (const contour of font.contours(font.glyph(cluster.text.codePointAt(0))))
          for (const point of contour) corners.push([x + point.x * scale, y - point.y * scale]);
      }
    const a = PNG.sync.read(readFileSync(new URL(`anima/${time}.png`, dir)));
    const b = PNG.sync.read(readFileSync(new URL(`rive/frames/${time}.png`, dir)));
    let over = 0;
    for (let y = 0; y < 240; y++)
      for (let x = 0; x < 240; x++) {
        const i = (y * 240 + x) * 4;
        let delta = 0;
        for (let k = 0; k < 4; k++)
          delta = Math.max(delta, Math.abs(a.data[i + k] - b.data[i + k]));
        if (delta <= c.threshold) continue;
        over++;
        if (
          !corners.some(
            ([cx, cy]) =>
              x - 1e-6 <= cx && cx <= x + 1 + 1e-6 && y - 1e-6 <= cy && cy <= y + 1 + 1e-6,
          )
        )
          throw Error(`${c.name}/${time}: non-corner difference at ${x},${y} (delta ${delta})`);
      }
    results.push({ name: c.name, time, over, nonCorner: 0 });
  }
}
writeFileSync(new URL('text-contour-check.json', root), JSON.stringify(results, null, 2) + '\n');
console.log(
  `${cases.length} cases / ${results.length} samples: all over-threshold pixels touch original-font glyph corners`,
);
