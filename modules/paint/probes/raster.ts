// Independent native path observer geometry, rasterized by the same renderer as Anima.
// This is evidence only: the oracle still compares the original, unmodified PNGs.
import '@anima-format/core/all';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { load, Player, toSVG } from '@anima-format/core';
import { toPNG } from '../../../packages/cli/src/render.ts';
import { pathToFileURL } from 'node:url';
import { compare } from '../../../tools/oracle.ts';
export function measureRaster() {
  const results = [];
  for (const name of [
    'straight-vertex',
    'mirrored-vertex',
    'asymmetric-vertex',
    'detached-vertex',
    'rounded-vertex',
    'trim-sequential',
    'trim-synchronized',
    'effect-order',
    'shared-effects',
  ]) {
    const base = `tests/oracle/drawing-paint-${name}/`;
    const p = new Player(load(JSON.parse(readFileSync(base + 'case.ani', 'utf8'))).model!);
    const actual = toPNG(
      toSVG(p, { background: '#ffffff', width: 240, height: 240, staticLengths: true }),
      240,
    );
    const lines: string[] = JSON.parse(readFileSync(base + 'rive/path-dump.json', 'utf8'));
    const d = lines
      .map((line) => {
        const [, , verb, ...points] = line.split(' ');
        return (
          ({ moveTo: 'M', lineTo: 'L', cubicTo: 'C', close: 'Z' }[verb!] ?? '') + points.join(' ')
        );
      })
      .join('');
    const nativeGeometry = toPNG(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="white"/><path d="${d}" fill="none" stroke="#4263eb" stroke-width="6" stroke-linecap="butt" stroke-linejoin="miter"/></svg>`,
    );
    const { diff: nativeGeometryDiff, ...sameRenderer } = compare(actual, nativeGeometry, 16);
    const { diff: nativeDiff, ...native } = compare(
      actual,
      readFileSync(base + 'rive/frames/0.png'),
      16,
    );
    void nativeGeometryDiff;
    void nativeDiff;
    const alpha = PNG.sync.read(toPNG(toSVG(p), 240));
    const a = PNG.sync.read(actual),
      b = PNG.sync.read(readFileSync(base + 'rive/frames/0.png'));
    let nonEdgeOver2 = 0,
      edgeOver2 = 0;
    for (let y = 0; y < 240; y++)
      for (let x = 0; x < 240; x++) {
        const i = (y * 240 + x) * 4;
        if (![0, 1, 2, 3].some((k) => Math.abs(a.data[i + k]! - b.data[i + k]!) > 2)) continue;
        const neighbors = [-1, 0, 1].flatMap((dy) =>
          [-1, 0, 1].map((dx) => {
            const px = x + dx,
              py = y + dy;
            return px < 0 || py < 0 || px >= 240 || py >= 240
              ? 0
              : alpha.data[(py * 240 + px) * 4 + 3]!;
          }),
        );
        if (neighbors.every((v) => v === 255) || neighbors.every((v) => v === 0)) nonEdgeOver2++;
        else edgeOver2++;
      }
    results.push({ name, sameRenderer, native, nonEdgeOver2, edgeOver2 });
  }
  return results;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const results = measureRaster();
  writeFileSync('modules/paint/probes/raster.json', JSON.stringify(results, null, 2) + '\n');
  console.log(results);
}
