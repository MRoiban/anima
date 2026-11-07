import type { Player } from '../../../packages/core/src/player.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import { drawFrame } from '../../../packages/core/src/draw.ts';
import { apply, mul, IDENTITY, type Mat } from '../../../packages/core/src/geom.ts';
import { parsePath, flatten } from '../../../packages/core/src/path.ts';
import type { A11yConfig, SemanticNode, SemanticDiff } from './types.ts';
import { states } from './registry.ts';
interface Entry {
  p: Player;
  i: number;
  id: string;
  parent: string;
  matrix: Mat;
  config?: A11yConfig;
  data: Record<string, unknown>;
  visible: boolean;
  bounds: SemanticNode['bounds'];
}
interface Cache {
  signature: string;
  tree: SemanticNode[];
  entries: Entry[];
}
const caches = new WeakMap<Player, Cache>();
const installed = new WeakSet<object>();
const flat = (tree: SemanticNode[]): SemanticNode[] =>
  tree.flatMap((n) => [n, ...flat(n.children)]);
const interactive = 'button checkbox switch radio slider tab link list-item'.split(' ');
const resolve = (p: Player, value: unknown) =>
  typeof value === 'string' ? (p.get(value) ?? value) : value;
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function semanticDiff(prev: SemanticNode[], next: SemanticNode[]): SemanticDiff {
  const a = new Map(flat(prev).map((n) => [n.id, n]));
  const b = new Map(flat(next).map((n) => [n.id, n]));
  return {
    added: [...b.keys()].filter((id) => !a.has(id)),
    removed: [...a.keys()].filter((id) => !b.has(id)),
    changed: [...b].flatMap(([id, n]) => {
      const old = a.get(id);
      if (!old) return [];
      const keys = [...new Set([...Object.keys(old), ...Object.keys(n)])].filter((k) =>
        k === 'children'
          ? !equal(
              old.children.map((c) => c.id),
              n.children.map((c) => c.id),
            )
          : !equal(old[k as keyof SemanticNode], n[k as keyof SemanticNode]),
      );
      return keys.length ? [{ id, keys }] : [];
    }),
  };
}
function box(points: [number, number][]): SemanticNode['bounds'] {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}
export function install(P: typeof Player, modules: ReadonlyMap<string, Module>) {
  if (installed.has(P.prototype)) return;
  installed.add(P.prototype);
  P.prototype.semanticDiff = semanticDiff;
  P.prototype.semantics = function () {
    const entries: Entry[] = [];
    const collect = (p: Player, prefix = '', parent = '', matrix = IDENTITY, visible = true) => {
      const frame = drawFrame(p);
      p.model.nodes.forEach((n, i) => {
        const c = n.raw.a11y as A11yConfig | undefined;
        const m = mul(matrix, p.world(i)),
          g = frame.nodes[i]?.geometry;
        let points: [number, number][] = [];
        let bounds = c?.bounds;
        if (!bounds && g) {
          if (g.d)
            points = flatten(parsePath(g.d)).flatMap((poly) =>
              poly.pts
                .filter((_, i) => i % 2 === 0)
                .map((x, i) => [x, poly.pts[i * 2 + 1]!] as [number, number]),
            );
          else if (g.r !== undefined) bounds = [g.cx! - g.r, g.cy! - g.r, g.r * 2, g.r * 2];
          else if (g.width !== undefined) bounds = [g.x ?? 0, g.y ?? 0, g.width, g.height ?? 0];
        }
        if (bounds) {
          const [x, y, w, h] = bounds;
          points = [
            [x, y],
            [x + w, y],
            [x, y + h],
            [x + w, y + h],
          ];
        }
        const data = Object.fromEntries(
          Object.entries(c ?? {}).map(([k, v]) => [
            k,
            ['role', 'live', 'href', 'activate'].includes(k) ? v : resolve(p, v),
          ]),
        );
        entries.push({
          p,
          i,
          id: prefix + n.id,
          parent: n.parent < 0 ? parent : prefix + p.model.nodes[n.parent]!.id,
          matrix: m,
          config: c,
          data,
          visible: visible && p.visible(i) && !data.hidden,
          bounds: box(
            (points.length ? points : [[0, 0] as [number, number]]).map((pt) => apply(m, ...pt)),
          ),
        });
      });
      for (const [id, child] of (p.nested as { players?: Map<string, Player> } | undefined)
        ?.players ?? []) {
        const entry = entries.find((e) => e.id === prefix + id)!;
        collect(child, prefix + id + '.', entry.id, entry.matrix, entry.visible);
      }
      const lists = modules.get('lists') as
        typeof import('../../lists/core/index.ts').lists | undefined;
      for (const run of lists?.listState(p)?.runs ?? [])
        for (const item of run.items) {
          const entry = entries.find((e) => e.p === p && e.i === run.spec.node)!;
          const raw = p.model.nodes[run.spec.node]!.raw;
          collect(
            item.player,
            entry.id + '.' + item.index + '.',
            entry.id,
            mul(entry.matrix, [1, 0, 0, 1, (raw.dx ?? 0) * item.index, (raw.dy ?? 0) * item.index]),
            entry.visible,
          );
        }
    };
    collect(this);
    const signature = JSON.stringify([
      this.focused,
      entries.map((e) => [e.id, e.parent, e.data, e.visible, e.bounds, e.p.focused]),
    ]);
    const old = caches.get(this);
    if (old?.signature === signature) return old.tree;
    const nodes = new Map<string, SemanticNode>();
    const tree: SemanticNode[] = [];
    const excluded = new Set<string>();
    // Parents precede descendants, including nested players.
    for (const e of entries) {
      if (!e.visible || excluded.has(e.parent)) {
        excluded.add(e.id);
        continue;
      }
      if (!e.config || e.config.role === 'none') continue;
      const c = e.config,
        d = e.data;
      const n: SemanticNode = {
        id: e.id,
        role: c.role,
        states: {},
        bounds: e.bounds,
        actions: [],
        children: [],
      };
      for (const key of ['label', 'hint', 'value', 'level', 'href'] as const)
        if (d[key] !== undefined) Object.assign(n, { [key]: d[key] });
      for (const key of states)
        if (key !== 'hidden' && d[key] !== undefined) Object.assign(n.states, { [key]: d[key] });
      if (d.checkedMixed) n.states.checked = 'mixed';
      if (c.live && c.live !== 'off') n.states.live = c.live;
      if (!d.disabled) {
        if (
          c.activate ||
          ['checked', 'pressed', 'selected'].some(
            (k) => typeof c[k as keyof A11yConfig] === 'string',
          )
        )
          n.actions.push('tap');
        if (c.role === 'slider') {
          n.min = c.min ?? 0;
          n.max = c.max ?? 100;
          n.step = c.step ?? 1;
          if (!d.readonly) n.actions.push('increase', 'decrease');
        }
        if (e.p.focusItems?.().some((f) => f.id === e.p.model.nodes[e.i]!.id))
          n.actions.push('focus');
      }
      if (n.actions.includes('focus')) {
        const focused = this.focused;
        let at = entries.find((e) => e.id === focused);
        while (at && at.id !== e.id) at = entries.find((e) => e.id === at!.parent);
        n.states.focused = !!at;
      }
      let parent = entries.find((entry) => entry.id === e.parent);
      while (parent && !nodes.has(parent.id))
        parent = entries.find((entry) => entry.id === parent!.parent);
      (parent ? nodes.get(parent.id)!.children : tree).push(n);
      nodes.set(e.id, n);
    }
    const prune = (list: SemanticNode[]) => {
      const modal = list.find((n) => n.states.modal);
      if (modal) list.splice(0, list.length, modal);
      list.forEach((n) => prune(n.children));
    };
    prune(tree);
    const live = flat(tree);
    if (this.focused && !live.some((n) => n.id === this.focused && n.actions.includes('focus'))) {
      const previous = old?.entries ?? entries;
      let ancestor = previous.find((e) => e.id === this.focused);
      while (ancestor && !live.some((n) => n.id === ancestor!.id && n.actions.includes('focus')))
        ancestor = previous.find((e) => e.id === ancestor!.parent);
      const order = previous.findIndex((e) => e.id === this.focused);
      const next =
        live.find(
          (n) => n.actions.includes('focus') && entries.findIndex((e) => e.id === n.id) > order,
        ) ?? live.find((n) => n.actions.includes('focus'));
      this.focusTarget?.(ancestor?.id ?? next?.id ?? null);
      caches.delete(this);
      return this.semantics();
    }
    caches.set(this, { signature, tree, entries });
    return tree;
  };
  P.prototype.semanticAction = function (id, action) {
    const node = flat(this.semantics()).find((n) => n.id === id);
    if (!node?.actions.includes(action)) return false;
    if (action === 'focus') return this.focusTarget?.(id) ?? false;
    const e = caches.get(this)!.entries.find((e) => e.id === id)!;
    const c = e.config!;
    if (action === 'tap') {
      if (c.readonly && resolve(e.p, c.readonly)) return false;
      const key =
        c.activate ?? [c.checked, c.pressed, c.selected].find((v) => typeof v === 'string');
      if (typeof key !== 'string') return false;
      if (e.p.model.inputs.get(key)?.type === 'trigger') e.p.fire(key);
      else e.p.set(key, !e.p.get(key));
    } else {
      const value = Math.max(
        node.min!,
        Math.min(node.max!, Number(node.value) + (action === 'increase' ? 1 : -1) * node.step!),
      );
      if (value === node.value) return false;
      e.p.set(c.value!, value);
    }
    return true;
  };
}
export function prepare(model: import('../../../packages/core/src/load.ts').Model, focus: boolean) {
  if (!model.nodes.some((n) => n.raw.a11y)) return;
  if (focus)
    for (const n of model.nodes)
      if (n.raw.a11y && interactive.includes(n.raw.a11y.role) && !n.raw.focus)
        n.raw = { ...n.raw, focus: { tabStops: true, bounds: n.raw.a11y.bounds } };
  const previous = model.afterStep;
  model.afterStep = (p) => {
    previous?.(p);
    p.semantics();
  };
}
