import '@anima-format/core/all';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { compile } from '../../../../packages/markup/src/index.ts';
import { load, Player } from '../../../../packages/core/src/index.ts';
import { frameSVG, LIGHT, toPNG } from '../../../../packages/cli/src/render.ts';
it('rasterises percentage dashes as seven separate runs instead of subpixel noise', () => {
  const source = readFileSync(new URL('../../../../examples/paint.animl', import.meta.url), 'utf8');
  const compiled = compile(source);
  const example = new Player(load(compiled.doc!).model!);
  expect(frameSVG(example, LIGHT)).not.toContain('pathLength');
  const panel = PNG.sync.read(toPNG(frameSVG(example, LIGHT), 400));
  // Scan outside the fill on the panel's straight top edge: two visible dash runs.
  let panelRuns = 0,
    panelPrevious = false;
  for (let x = 100; x < 300; x++) {
    const ink = panel.data[(36 * panel.width + x) * 4 + 3]! > 128;
    if (ink && !panelPrevious) panelRuns++;
    panelPrevious = ink;
  }
  expect(panelRuns).toBe(2);
  const r = load({
    anima: '0.1',
    name: 'dashes',
    grid: 20,
    requires: ['paint'],
    nodes: [
      {
        id: 'a',
        type: 'path',
        d: 'M0 10L20 10',
        stroke: { color: '#000', width: 1, cap: 'butt', dash: ['10%', '5%'] },
      },
    ],
  });
  const png = PNG.sync.read(toPNG(frameSVG(new Player(r.model!), LIGHT), 400));
  let runs = 0,
    previous = false;
  for (let x = 0; x < png.width; x++) {
    const ink = png.data[(200 * png.width + x) * 4 + 3]! > 128;
    if (ink && !previous) runs++;
    previous = ink;
  }
  expect(runs).toBe(7);
});
it('rasterises a quarter-trimmed circle arc with quarter coverage', () => {
  const render = (trimEnd: number) => {
    const r = load({
      anima: '0.1',
      name: 'trim',
      grid: 20,
      nodes: [
        {
          id: 'a',
          type: 'arc',
          center: [10, 10],
          r: 7,
          from: 0,
          to: 360,
          stroke: { color: '#000', width: 1, cap: 'butt', trimEnd },
        },
      ],
    });
    const png = PNG.sync.read(toPNG(frameSVG(new Player(r.model!), LIGHT), 400));
    let alpha = 0;
    for (let i = 3; i < png.data.length; i += 4) alpha += png.data[i]!;
    return alpha;
  };
  expect(render(0.25) / render(1)).toBeCloseTo(0.25, 2);
});
