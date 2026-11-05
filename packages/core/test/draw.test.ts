import '@anima-format/core/all';
import { describe, expect, it } from 'vitest';
import {
  drawFrame,
  drawTree,
  load,
  Player,
  attrs,
  staticSlots,
  registerModule,
} from '../src/index.ts';

const circle = (id: string, extra: object = {}) => ({
  id,
  type: 'circle',
  center: [10, 10],
  r: 4,
  fill: { color: 'currentColor' },
  ...extra,
});
function player(nodes: object[], extra: object = {}) {
  const result = load({ anima: '0.1', name: 'draw', grid: 20, nodes, ...extra });
  expect(result.diagnostics).toEqual([]);
  return new Player(result.model!);
}
describe('renderer-neutral draw contract', () => {
  it('builds the static tree at load and retains unchanged records independently of dirty reads', () => {
    const p = player([circle('a'), circle('b')], {
      timelines: {
        t: {
          duration: 1,
          tracks: {
            'a.r': [
              [0, 4],
              [1, 8],
            ],
          },
        },
      },
      machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
    });
    expect(p.model.draw).toBe(drawTree(p.model));
    const first = drawFrame(p),
      stable = first.nodes[1];
    expect(first.changed).toEqual([0, 1]);
    const revision = first.revision;
    p.takeDirty();
    p.step(0.5);
    p.takeDirty();
    const next = drawFrame(p);
    expect(next.revision).toBeGreaterThan(revision);
    expect(next.changed).toEqual([0]);
    expect(next.nodes[1]).toBe(stable);
    expect(next.nodes[0]!.geometry).toEqual({ kind: 'circle', cx: 10, cy: 10, r: 6 });
    expect(drawFrame(p)).toBe(next);
    expect(
      attrs(next, { tag: 'circle', role: 'shape', node: 0, kids: [] }, staticSlots(), 'a').r,
    ).toBe('6');
    expect(JSON.stringify(next)).not.toMatch(/"(?:tag|attrs|stroke-dasharray|gradientUnits)"/);
  });
  it('resolves slots, gradients, path geometry and grid-unit dashes before any backend runs', () => {
    const p = player(
      [
        {
          id: 'line',
          type: 'path',
          d: 'M0 0L10 0',
          fill: {
            type: 'linear',
            x1: 0,
            y1: 0,
            x2: 10,
            y2: 0,
            stops: [
              { position: 0, color: 'accent' },
              { position: 1, color: '#fff' },
            ],
          },
          stroke: { color: 'accent', dash: ['10%', '20%'], dashOffset: 0.1, scale: 'fixed' },
        },
      ],
      { requires: ['paint'], colors: { accent: '#123456' } },
    );
    const f = drawFrame(p),
      [fill, stroke] = f.nodes[0]!.paints;
    expect(fill).toMatchObject({
      type: 'linear',
      coordinates: { x1: 0, y1: 0, x2: 10, y2: 0 },
      stops: [
        { position: 0, color: { slot: 'accent', fallback: '#123456' } },
        { position: 1, color: '#fff' },
      ],
    });
    expect(stroke).toMatchObject({
      color: { slot: 'accent', fallback: '#123456' },
      dash: [1, 2],
      dashOffset: 1,
      dashNormalized: [0.1, 0.2],
      scale: 'fixed',
    });
    expect(f.tree.resources).toContainEqual(
      expect.objectContaining({ node: 0, kind: 'gradient', key: 'fill' }),
    );
  });
  it('resolves compositing references/ranks and invalidates spatial dependencies without unrelated nodes', () => {
    const p = player(
      [
        { id: 'g', type: 'group', children: [circle('source')] },
        circle('target', {
          clip: { source: 'source', rule: 'evenodd' },
          drawOrder: { target: 'g', position: 'before' },
        }),
        circle('untouched'),
      ],
      {
        requires: ['composite'],
        timelines: {
          t: {
            duration: 1,
            tracks: {
              'g.x': [
                [0, 0],
                [1, 2],
              ],
            },
          },
        },
        machine: { layers: { l: { initial: 's', states: { s: { play: 't' } } } } },
      },
    );
    const f = drawFrame(p),
      stable = f.nodes[3];
    expect(f.nodes[2]!.clip).toEqual({ source: 1, rule: 'evenodd' });
    expect(f.order![2]).toBeLessThan(f.order![0]!);
    expect(f.tree.resources).toContainEqual({ node: 2, kind: 'clip', source: 1 });
    p.step(1);
    const next = drawFrame(p);
    expect(next.changed).toEqual([0, 1]);
    expect(next.nodes[1]!.world![4]).toBe(2);
    expect(next.nodes[3]).toBe(stable);
  });
  it.each([
    ['paint', { stroke: { color: '#000', dash: [1, 1] } }, 'composite', '/nodes/0/stroke/dash'],
    ['composite', { blend: 'multiply' }, 'paint', '/nodes/0/blend'],
  ] as const)('requires the owning %s feature', (feature, extra, wrong, pointer) => {
    const result = load({
      anima: '0.1',
      name: 'declared',
      grid: 20,
      requires: [wrong],
      nodes: [circle('a', extra)],
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'undeclared-feature',
        pointer,
        hint: `add "${feature}" to "requires"`,
      }),
    );
  });
  it('does not invoke an undeclared module while sampling ordered paints', () => {
    let calls = 0;
    registerModule({
      name: 'dormant',
      entries: [],
      draw: {
        frame() {
          calls++;
        },
      },
    });
    const p = player(
      [{ id: 'a', type: 'circle', center: [10, 10], r: 4, paints: [{ fill: { color: '#000' } }] }],
      { requires: ['composite'] },
    );
    drawFrame(p);
    expect(calls).toBe(0);
  });
});
