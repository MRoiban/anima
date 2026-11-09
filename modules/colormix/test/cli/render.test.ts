import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { frameSVG, LIGHT, toPNG } from '../../../../packages/cli/src/render.ts';
it('CLI resolves slot defaults and rasterises a single track at 0, 0.5, 1', () => {
  const r = load(readFileSync(new URL('../../examples/switch.ani', import.meta.url), 'utf8'));
  expect(r.diagnostics).toEqual([]);
  const p = new Player(r.model!);
  for (const [dt, want] of [
    [0, 0],
    [0.5, 128],
    [0.5, 255],
  ]) {
    p.step(dt!);
    const image = PNG.sync.read(toPNG(frameSVG(p, LIGHT), 200));
    const i = (100 * image.width + 100) * 4;
    expect([...image.data.subarray(i, i + 4)]).toEqual([want, want, want, 255]);
  }
});
