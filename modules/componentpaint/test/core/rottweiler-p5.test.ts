import '@anima-format/core/all';
import { expect, it } from 'vitest';
import { load, Player, toSVG } from '../../../../packages/core/src/index.ts';

// R2-04: a component paint source resolves image assets in the enclosing document catalog.
it('resolves enclosing assets in a component paint source', () => {
  const source = 'data:image/png;base64,iVBORw0KGgo=';
  const { model, diagnostics } = load({
    anima: '0.1',
    name: 'paint-assets',
    grid: 24,
    requires: ['components', 'paint', 'componentpaint', 'assets'],
    assets: { pic: { type: 'image', source, width: 1, height: 1 } },
    components: {
      tile: {
        grid: 24,
        nodes: [{ id: 'im', type: 'image', asset: 'pic', x0: 0, y0: 0, width: 24, height: 24 }],
      },
    },
    nodes: [
      { id: 'rect', type: 'rect', x0: 0, y0: 0, w: 24, h: 24, fill: { paint: 'component:tile' } },
    ],
  });
  expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  const p = new Player(model!);
  p.step(0);
  expect(toSVG(p)).toContain(source);
});
