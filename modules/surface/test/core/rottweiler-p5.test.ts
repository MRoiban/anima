import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, toSVG } from '../../../../packages/core/src/index.ts';
import { svgBackends } from '../../../../packages/core/src/svg.ts';

// SVG backends run in registration order; separately loaded web entries can register in any order.
function inOrder<T>(order: string[], run: () => T): T {
  const saved = new Map(svgBackends);
  try {
    svgBackends.clear();
    for (const name of order) svgBackends.set(name, saved.get(name)!);
    for (const [name, backend] of saved) if (!svgBackends.has(name)) svgBackends.set(name, backend);
    return run();
  } finally {
    svgBackends.clear();
    for (const [name, backend] of saved) svgBackends.set(name, backend);
  }
}
const missingRefs = (svg: string) => {
  const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  return [...svg.matchAll(/url\(#([^)]*)\)/g)].map((m) => m[1]).filter((r) => !ids.has(r));
};
const uri =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><path fill="blue" d="M0 0H4V4H0Z"/></svg>',
  );
const common = {
  anima: '0.1',
  name: 'rottweiler-p5',
  grid: 24,
  requires: ['paint', 'composite', 'surface', 'assets'],
  assets: { tile: { type: 'image', source: uri, width: 4, height: 4 } },
};

// Rottweiler P5 R5-01: an ordered image paint references surface's pattern in either backend order.
it('keeps ordered image paint pattern references in both backend orders', () => {
  const { model, diagnostics } = load({
    ...common,
    nodes: [
      {
        id: 'r',
        type: 'rect',
        x0: 4,
        y0: 4,
        w: 16,
        h: 16,
        paints: [
          {
            fill: {
              type: 'image',
              asset: 'tile',
              imageWidth: 4,
              imageHeight: 4,
              feather: { outer: 3 },
            },
          },
        ],
      },
    ],
  });
  expect(diagnostics).toEqual([]);
  for (const order of [
    ['paint', 'surface', 'composite'],
    ['paint', 'composite', 'surface'],
  ])
    expect(inOrder(order, () => missingRefs(toSVG(new Player(model!))))).toEqual([]);
});

// R5-03: images copied into definitions (mask sources, slices) get their href when assets is last.
it('converts images inside definitions when the assets backend runs last', () => {
  const image = { id: 'im', type: 'image', asset: 'tile', x0: 0, y0: 0, width: 24, height: 24 };
  for (const nodes of [
    [
      image,
      {
        id: 'r',
        type: 'rect',
        x0: 0,
        y0: 0,
        w: 24,
        h: 24,
        fill: { color: '#ff0000' },
        mask: { source: 'im', mode: 'alpha', sourceDraws: false },
      },
    ],
    [{ ...image, slice: { x: [0, 24], y: [0, 24], width: 24, height: 24 } }],
  ]) {
    const { model, diagnostics } = load({
      ...common,
      assets: { tile: { type: 'image', source: uri, width: 24, height: 24 } },
      nodes,
    });
    expect(diagnostics).toEqual([]);
    const svg = inOrder(['paint', 'composite', 'surface', 'assets'], () =>
      toSVG(new Player(model!)),
    );
    const images = [...svg.matchAll(/<image [^>]*>/g)].map((m) => m[0]);
    expect(images.length).toBeGreaterThan(0);
    for (const tag of images) expect(tag).toContain('href="' + uri + '"');
  }
});
