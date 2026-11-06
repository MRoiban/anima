// Tests a periodic, bilinear 512-texel colour ramp hypothesis against the ORIGINAL native PNG.
// Never used by the renderer or oracle, and never changes the reference image.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';
export function measureAngular() {
  const source = PNG.sync.read(
    readFileSync('tests/oracle/drawing-paint-gradient-angular/rive/frames/0.png'),
  );
  const actual = PNG.sync.read(
    readFileSync('tests/oracle/drawing-paint-gradient-angular/anima/0.png'),
  );
  const results = [];
  for (const size of [128, 256, 512, 1024]) {
    let max = 0,
      over2 = 0,
      over16 = 0;
    for (let y = 0; y < 240; y++)
      for (let x = 0; x < 240; x++) {
        const t = Math.atan2(y + 0.5, x + 0.5) / (2 * Math.PI);
        const u = t * size - 0.5,
          j = Math.floor(u),
          f = u - j;
        const left = (((j % size) + size) % size) / (size - 1),
          right = ((j + 1) % size) / (size - 1);
        for (let k = 0; k < 3; k++) {
          const start = [66, 99, 235][k]!,
            end = [217, 119, 87][k]!;
          const c = Math.round(start + (end - start) * (left * (1 - f) + right * f));
          const delta = Math.abs(c - source.data[(y * 240 + x) * 4 + k]!);
          max = Math.max(max, delta);
          if (delta > 2) over2++;
          if (delta > 16) over16++;
        }
      }
    results.push({
      rampTexels: size,
      maxChannelDelta: max,
      channelsOver2: over2,
      channelsOver16: over16,
    });
  }
  let seamMax = 0,
    interiorMax = 0,
    seamOver2 = 0,
    interiorOver2 = 0;
  for (let y = 0; y < 240; y++)
    for (let x = 0; x < 240; x++) {
      const i = (y * 240 + x) * 4;
      const d = Math.max(
        ...[0, 1, 2, 3].map((k) => Math.abs(source.data[i + k]! - actual.data[i + k]!)),
      );
      if (y === 0) {
        seamMax = Math.max(seamMax, d);
        if (d > 2) seamOver2++;
      } else {
        interiorMax = Math.max(interiorMax, d);
        if (d > 2) interiorOver2++;
      }
    }
  const holdout = PNG.sync.read(readFileSync('modules/paint/probes/angular-holdout/frame.png'));
  let holdoutMax = 0,
    holdoutChannelsOver2 = 0;
  for (let y = 0; y < 240; y++)
    for (let x = 0; x < 240; x++) {
      const q = (Math.atan2(y + 0.5, x + 0.5) / (2 * Math.PI)) * 512 - 0.5;
      const j = Math.floor(q),
        f = q - j;
      const t = (((j + 512) % 512) * (1 - f) + ((j + 1) % 512) * f) / 511;
      for (let k = 0; k < 3; k++) {
        const d = Math.abs(Math.round(255 * t) - holdout.data[(y * 240 + x) * 4 + k]!);
        holdoutMax = Math.max(holdoutMax, d);
        if (d > 2) holdoutChannelsOver2++;
      }
    }
  const centered = PNG.sync.read(readFileSync('modules/paint/probes/angular-centered/frame.png'));
  const ignoredCenterMax = source.data.reduce(
    (max, v, i) => Math.max(max, Math.abs(v - centered.data[i]!)),
    0,
  );
  const evidence = {
    samplerModels: results,
    seamMax,
    interiorMax,
    seamOver2,
    interiorOver2,
    holdoutMax,
    holdoutChannelsOver2,
    ignoredCenterMax,
  };
  return evidence;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const evidence = measureAngular();
  writeFileSync('modules/paint/probes/angular.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(evidence);
}
