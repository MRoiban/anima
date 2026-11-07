import '../../../../packages/core/src/all.ts';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { load, Player, drawFrame, drawOrder, toSVG } from '../../../../packages/core/src/index.ts';
function dense(p: Player) {
  const f = drawFrame(p);
  expect(f.nodes.length).toBe(f.tree.nodes.length);
  for (let i = 0; i < f.tree.nodes.length; i++) {
    expect(f.tree.nodes[i], 'tree slot ' + i).toBeDefined();
    expect(f.nodes[i]?.transform, 'frame slot ' + i).toHaveLength(6);
  }
  return f;
}
describe('nested draw allocation lifecycle', () => {
  it.each([
    'data-property-artboard',
    'components-stateful-output',
    'components-nested-remap',
    'components-nested-quantize',
    'components-leaf-fit',
  ])('replays a player-owned model without inheriting orphan slots: %s', (name) => {
    const model = load(readFileSync(`spec/conformance/${name}/case.ani`, 'utf8')).model!;
    const original = new Player(model);
    original.step(0);
    const first = dense(original);
    const replay = new Player(original.model);
    replay.step(0);
    const second = dense(replay);
    expect(second.tree).not.toBe(first.tree);
    expect(second.nodes.length).toBe(first.nodes.length);
    expect(toSVG(replay)).toBe(toSVG(original));
    dense(new Player(replay.model));
  });
  it('keeps retired frames hidden and reuses dense slots across empty and unequal choices', () => {
    const doc = JSON.parse(
      readFileSync('spec/conformance/data-property-artboard/case.ani', 'utf8'),
    );
    // A larger choice exercises unconsumed free slots after replacing it by a smaller child.
    doc.components.box.nodes.push({
      id: 'extra',
      type: 'circle',
      center: [2, 2],
      r: 1,
      fill: { color: '#000' },
    });
    doc.requires.push('composite');
    doc.components.box.nodes[0].mask = { source: 'extra', mode: 'alpha', sourceDraws: false };
    const p = new Player(load(doc).model!);
    for (const name of ['box', '', 'row', 'box', 'row', '', 'row']) {
      p.set('$card', name);
      p.step(0);
      const f = dense(p);
      const reachable = new Set<number>();
      const visit = (i: number) => {
        reachable.add(i);
        f.tree.nodes[i]!.children.forEach(visit);
      };
      f.tree.roots.forEach(visit);
      f.nodes.forEach((n, i) => {
        if (!reachable.has(i)) {
          expect(n.visible).toBe(false);
          expect(n.paints).toEqual([]);
          expect(n.mask).toBeUndefined();
          expect(n.clip).toBeUndefined();
          expect(f.tree.nodes[i]!.parent).toBe(-1);
          expect(f.tree.nodes[i]!.children).toEqual([]);
        }
      });
    }
  });
  it('preserves child-authored paint order when slot reuse reverses the allocated indices', () => {
    const doc = JSON.parse(
      readFileSync('spec/conformance/data-property-artboard/case.ani', 'utf8'),
    );
    const nodes = [
      { id: 'red', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#ff0000' } },
      { id: 'blue', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#0000ff' } },
    ];
    for (const name of ['row', 'box']) {
      doc.components[name].nodes = structuredClone(nodes);
      delete doc.components[name].bind;
    }
    const p = new Player(load(doc).model!);
    for (const name of ['row', 'box', 'row', 'box']) {
      p.set('$card', name);
      p.step(0);
      const f = dense(p),
        group = f.tree.nodes[0]!.children[0]!;
      expect(drawOrder(f, f.tree.nodes[group]!.children).map((i) => f.tree.nodes[i]!.id)).toEqual([
        'badge/red',
        'badge/blue',
      ]);
    }
  });
});
