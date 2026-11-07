import type { Model, NodeM } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { ComponentModule } from '../../components/core/index.ts';
import type { DataModule } from '../../data/core/index.ts';
import {
  drawFrame,
  drawTree,
  type DrawTree,
  type DrawFrame,
} from '../../../packages/core/src/draw.ts';
import { mul, invert, type Mat } from '../../../packages/core/src/geom.ts';
export const dynamicTrees = new WeakSet<DrawTree>();
// A Player may be constructed from another player's model (script replay/host replacement).
// Never inherit that player's allocated slots without their matching frame records.
const origins = new WeakMap<DrawTree, { tree: DrawTree; afterStep: Model['afterStep'] }>();
export function fit(node: NodeM, child: Model): Mat {
  const raw = node.raw;
  if (!raw.size) return [1, 0, 0, 1, 0, 0];
  const [x, y, w, h] = child.viewBox,
    [tw, th] = raw.size;
  let sx = tw / w,
    sy = th / h;
  const scale =
    raw.fit === 'cover'
      ? Math.max(sx, sy)
      : raw.fit === 'none'
        ? 1
        : raw.fit === 'scale-down'
          ? Math.min(1, sx, sy)
          : raw.fit === 'fit-width'
            ? sx
            : raw.fit === 'fit-height'
              ? sy
              : Math.min(sx, sy);
  if (raw.fit !== 'fill') sx = sy = scale;
  const align = raw.align ?? 'center';
  const factor = (lo: string, hi: string) =>
    align.includes(lo) ? 0 : align.includes(hi) ? 1 : 0.5;
  return [
    sx,
    0,
    0,
    sy,
    (tw - w * sx) * factor('left', 'right') - x * sx,
    (th - h * sy) * factor('top', 'bottom') - y * sy,
  ];
}
export function dynamic(p: Player, components: ComponentModule, data?: DataModule) {
  const model = p.model,
    origin = origins.get(drawTree(model)),
    tree = origin?.tree ?? drawTree(model);
  const draw = {
    ...tree,
    nodes: tree.nodes.map((n) => ({ ...n, children: [...n.children] })),
    roots: [...tree.roots],
    resources: [...tree.resources],
  };
  const previous = origin ? origin.afterStep : model.afterStep;
  const clone = {
    ...model,
    draw,
    afterStep: (p: Player) => {
      previous?.(p);
      drawFrame(p);
    },
  };
  Object.defineProperty(p, 'model', { value: clone });
  components.forkModel(model, clone);
  const c = data?.compiled.get(model);
  if (c) data!.compiled.set(clone, c);
  dynamicTrees.add(draw);
  origins.set(draw, { tree, afterStep: previous });
  drawings.set(p, { mappings: new Map(), free: [], resources: [...draw.resources] });
}
function fitLists(p: Player, frame: DrawFrame) {
  if (!p.model.doc.requires?.includes('nested') || !p.model.doc.requires.includes('lists')) return;
  const players = (p.nested as { players?: Map<string, Player> } | undefined)?.players;
  for (const [id, child] of players ?? []) {
    const index = p.model.ids.get(id)!,
      n = p.model.nodes[index]!;
    for (const group of frame.tree.nodes[index]!.children) {
      const t = fit(n, child.model),
        f = frame.nodes[group]!;
      if (n.raw.component.startsWith('$') && p.get(n.raw.component) === '') {
        f.visible = false;
        frame.changed.push(group);
        continue;
      }
      const world = mul(p.world(index), t),
        inverse = f.world && invert(f.world);
      if (inverse) {
        const delta = mul(world, inverse);
        const visit = (node: number) => {
          const f = frame.nodes[node]!;
          if (f.world) f.world = mul(delta, f.world);
          for (const c of frame.tree.nodes[node]!.children) visit(c);
        };
        for (const node of frame.tree.nodes[group]!.children) visit(node);
      }
      f.transform = t;
      f.world = world;
      frame.changed.push(group);
    }
  }
}
interface Drawing {
  mappings: Map<Player, { group: number; nodes: number[] }>;
  free: number[];
  resources: DrawTree['resources'];
  players?: Map<string, Player>;
}
const drawings = new WeakMap<Player, Drawing>();
export function render(p: Player, frame: import('../../../packages/core/src/draw.ts').DrawFrame) {
  const drawing = drawings.get(p);
  if (!drawing) {
    fitLists(p, frame);
    return;
  }
  const tree = frame.tree;
  const retire = (node: number) => {
    tree.nodes[node] = { node, kind: 'group', parent: -1, children: [] };
    frame.nodes[node] = { transform: [1, 0, 0, 1, 0, 0], opacity: 1, visible: false, paints: [] };
    return node;
  };
  const entries: { player: Player; parent: number; id: string; index?: number }[] = [];
  const players = (p.nested as { players?: Map<string, Player> } | undefined)?.players;
  for (const [id, child] of players ?? [])
    if (
      !p.model.nodes[p.model.ids.get(id)!]!.raw.component.startsWith('$') ||
      p.get(p.model.nodes[p.model.ids.get(id)!]!.raw.component) !== ''
    )
      entries.push({ player: child, parent: p.model.ids.get(id)!, id });
  const active = new Set(entries.map((e) => e.player));
  for (const [player, m] of drawing.mappings)
    if (!active.has(player)) {
      drawing.free.push(m.group, ...m.nodes);
      for (const n of [m.group, ...m.nodes]) {
        retire(n);
        frame.changed.push(n);
      }
      drawing.mappings.delete(player);
    }
  for (const n of p.model.nodes)
    if ((n.type as string) === 'instance') {
      const e = tree.nodes[p.model.ids.get(n.id)!]!;
      e.kind = 'group';
      e.children = [];
    }
  tree.resources = [...drawing.resources];
  const allocate = () => retire(drawing.free.pop() ?? tree.nodes.length);
  for (const entry of entries) {
    const child = drawFrame(entry.player);
    let mapping = drawing.mappings.get(entry.player);
    if (!mapping) {
      mapping = { group: allocate(), nodes: [] };
      drawing.mappings.set(entry.player, mapping);
    }
    while (mapping.nodes.length < child.tree.nodes.length) mapping.nodes.push(allocate());
    const group = mapping.group,
      shift = (n: number) => mapping!.nodes[n]!;
    const transform = fit(p.model.nodes[entry.parent]!, entry.player.model);
    tree.nodes[group] = {
      node: group,
      kind: 'group',
      id: entry.id,
      parent: entry.parent,
      children: child.tree.roots.map(shift),
    };
    tree.nodes[entry.parent]!.children.push(group);
    frame.nodes[group] = { transform, opacity: 1, visible: true, paints: [] };
    frame.changed.push(group);
    (frame.order ??= [])[group] = entry.index ?? group;
    const world = mul(p.world(entry.parent), transform);
    frame.nodes[group]!.world = world;
    child.tree.nodes.forEach((n, i) => {
      const source = child.nodes[i]!;
      tree.nodes[shift(i)] = {
        ...n,
        node: shift(i),
        id: entry.id + '/' + (n.id ?? entry.player.model.nodes[n.node]?.id),
        parent: n.parent < 0 ? group : shift(n.parent),
        children: n.children.map(shift),
        dependencies: undefined,
        mask: n.mask ? { ...n.mask, source: shift(n.mask.source) } : undefined,
        clip: n.clip ? { ...n.clip, source: shift(n.clip.source) } : undefined,
      };
      frame.nodes[shift(i)] = {
        ...source,
        world: source.world ? mul(world, source.world) : undefined,
        mask: source.mask ? { ...source.mask, source: shift(source.mask.source) } : undefined,
        clip: source.clip ? { ...source.clip, source: shift(source.clip.source) } : undefined,
      };
      frame.changed.push(shift(i));
      (frame.order ??= [])[shift(i)] = child.order?.[i] ?? i;
    });
    for (const r of child.tree.resources)
      tree.resources.push({
        ...r,
        node: shift(r.node),
        source: r.source === undefined ? undefined : shift(r.source),
      });
  }
}
