import '../../../../packages/core/src/all.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { load, runScript, toSVG } from '../../../../packages/core/src/index.ts';
import { compile } from '../../../../packages/markup/src/index.ts';
const root = 'modules/componentpaint/oracle/live/';
const xml = readFileSync('modules/componentpaint/examples/live.animl', 'utf8')
  .replace('viewBox="-2 -1 10 10"', 'viewBox="-5 -5 10 10"')
  .replaceAll('x0="-2"', 'x0="-5"')
  .replaceAll('y0="-1"', 'y0="-5"');
describe('native component paint oracle', () => {
  it('matches independent source-clock/tiling expectations and all three captured native frames', () => {
    const built = compile(xml);
    expect(built.diagnostics).toEqual([]);
    const model = load(built.doc!).model!;
    const metrics = [];
    for (const [name, time] of [
      ['initial', 0],
      ['half', 0.5],
      ['end', 1],
    ] as const) {
      const native = PNG.sync.read(readFileSync(root + `frames/${name}.png`));
      const p = runScript(model, `advance ${time}`).player;
      const actual = PNG.sync.read(
        new Resvg(toSVG(p), { fitTo: { mode: 'width', value: 20 } }).render().asPng(),
      );
      expect([native.width, native.height, actual.width, actual.height]).toEqual([20, 20, 20, 20]);
      let max = 0,
        over = 0;
      for (let y = 0; y < 20; y++)
        for (let x = 0; x < 20; x++) {
          const tx = (((x + 5 - 6 * time) % 10) + 10) % 10;
          const expected = tx < 2 ? [224, 128, 32, 255] : [32, 64, 128, 255];
          for (let c = 0; c < 4; c++) {
            const index = (y * 20 + x) * 4 + c;
            expect(actual.data[index], `${name} ${x},${y} channel${c}`).toBe(expected[c]);
            const delta = Math.abs(actual.data[index]! - native.data[index]!);
            max = Math.max(max, delta);
            if (delta > 16) over++;
          }
        }
      metrics.push({ name, time, maxDiff: max, channelsOver16: over, pixels: 400 });
      // Native rasterizer dithers these flat colors by one byte. No geometry tolerance.
      expect(max).toBeLessThanOrEqual(1);
      expect(over).toBe(0);
    }
    expect(metrics).toHaveLength(3);
    // Retain measured results for review, without changing the central oracle manifest/inputs.
    writeFileSync(
      'modules/componentpaint/verification/native-metrics.json',
      JSON.stringify(metrics, null, 2) + '\n',
    );
  });
});
