// Numerical evidence: raw pixel differences versus the independently observed native paths.
import '@anima-format/core/all';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { load, Player, toSVG, drawFrame } from '@anima-format/core';
import { toPNG } from '../../../packages/cli/src/render.ts';
const measurements = [];
for (const name of [
  'straight-vertex',
  'mirrored-vertex',
  'asymmetric-vertex',
  'detached-vertex',
  'rounded-vertex',
  'trim-sequential',
  'trim-synchronized',
]) {
  const base = `tests/oracle/drawing-paint-${name}/`;
  const player = new Player(load(JSON.parse(readFileSync(base + 'case.ani', 'utf8'))).model!);
  const alpha = PNG.sync.read(toPNG(toSVG(player), 240));
  const actual = PNG.sync.read(readFileSync(base + 'anima/0.png'));
  const native = PNG.sync.read(readFileSync(base + 'rive/frames/0.png'));
  let max = 0,
    over = 0,
    interior = 0,
    exterior = 0,
    interiorOver2 = 0,
    exteriorOver2 = 0;
  for (let y = 0; y < 240; y++)
    for (let x = 0; x < 240; x++) {
      const i = (y * 240 + x) * 4;
      let d = 0;
      for (let k = 0; k < 4; k++)
        d = Math.max(d, Math.abs(actual.data[i + k]! - native.data[i + k]!));
      max = Math.max(max, d);
      if (d > 16) over++;
      const neighbors = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const px = x + dx,
            py = y + dy;
          neighbors.push(
            px < 0 || py < 0 || px >= 240 || py >= 240 ? 0 : alpha.data[(py * 240 + px) * 4 + 3]!,
          );
        }
      if (neighbors.every((v) => v === 255)) {
        interior++;
        if (d > 2) interiorOver2++;
      }
      if (neighbors.every((v) => v === 0)) {
        exterior++;
        if (d > 2) exteriorOver2++;
      }
    }
  const f = drawFrame(player).nodes[0]!;
  measurements.push({
    name,
    animaPath: f.paints[0]!.geometry?.d ?? f.geometry!.d,
    nativeCommands: JSON.parse(readFileSync(base + 'rive/path-dump.json', 'utf8')),
    max,
    over,
    percent: (100 * over) / 57600,
    interior,
    exterior,
    interiorOver2,
    exteriorOver2,
  });
}
writeFileSync('modules/paint/probes/geometry.json', JSON.stringify(measurements, null, 2) + '\n');
console.log(
  measurements.map((m) => ({
    name: m.name,
    interiorOver2: m.interiorOver2,
    exteriorOver2: m.exteriorOver2,
  })),
);
