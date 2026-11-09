import type { Player } from '../../../packages/core/src/player.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import { drawFrame, drawWorld } from '../../../packages/core/src/draw.ts';
import { apply, mul, IDENTITY, type Mat } from '../../../packages/core/src/geom.ts';
import { parsePath, flatten } from '../../../packages/core/src/path.ts';
import type { A11yConfig, SemanticNode } from './types.ts';
import { states } from './registry.ts';
import { flat } from './tree.ts';
export interface Entry {
  p: Player;
  i: number;
  id: string;
  parent: string;
  matrix: Mat;
  config?: A11yConfig;
  data: Record<string, unknown>;
  visible: boolean;
  bounds?: SemanticNode['bounds'];
}
export interface Cache {
  signature: string;
  valid: () => boolean;
  tree: SemanticNode[];
  entries: Entry[];
}
const caches = new WeakMap<Player, Cache>();
/** Shared through the active registry, including separately bundled action entries. */
export const runtime: {
  caches: typeof caches;
  flat: typeof flat;
  bounds?: typeof import('./bounds.ts').paintedBounds;
  version?: number;
  enrich?: (entries: Entry[], track: <T>(read: () => T) => T) => void;
  /** Runs after `enrich`, before the signature; owned by text-input so `enrich` can be replaced. */
  refine?: (entries: Entry[]) => void;
  update?: (p: Player, cache: Cache, previous?: Cache) => boolean;
} = { caches, flat };
function box(points: [number, number][]): SemanticNode['bounds'] {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}
export function install(P: typeof Player, modules: ReadonlyMap<string, Module>) {
  if ('semantics' in (P.prototype as object)) return;
  P.prototype.semantics = function () {
    const old = caches.get(this);
    if (old?.valid()) return old.tree;
    const checks: (() => boolean)[] = [];
    const track = <T>(read: () => T): T => {
      const value = read();
      checks.push(() => read() === value);
      return value;
    };
    track(() => runtime.version);
    track(() => runtime.enrich);
    track(() => runtime.refine);
    track(() => runtime.bounds);
    const entries: Entry[] = [];
    const collect = (p: Player, prefix = '', parent = '', matrix = IDENTITY, visible = true) => {
      for (const [address, { key }] of p.model.addrs)
        if (
          !(
            runtime.bounds ? /^(opacity|drawOrder)/ : /^(opacity|fill|stroke|paints|drawOrder)/
          ).test(key)
        )
          track(() => p.value(address));
      track(() => p.focused);
      const children = (p.nested as { players?: Map<string, Player> } | undefined)?.players;
      track(() => children?.size);
      const frame = drawFrame(p);
      track(() => p.drawRevision);
      p.model.nodes.forEach((n, i) => {
        const c = n.raw.a11y as A11yConfig | undefined;
        const m = mul(matrix, drawWorld(p, i, frame)),
          g = frame.nodes[i]?.geometry;
        let points: [number, number][] = [];
        let bounds = c?.bounds;
        if (!bounds && g) {
          if (g.d)
            points = flatten(parsePath(g.d)).flatMap((poly) =>
              Array.from(
                { length: poly.pts.length / 2 },
                (_, i) => poly.pts.slice(i * 2, i * 2 + 2) as [number, number],
              ),
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
        const data: Record<string, unknown> = { ...c };
        for (const k in data)
          if (
            typeof data[k] === 'string' &&
            !['role', 'live', 'href', 'activate', 'controls'].includes(k)
          )
            data[k] = track(() => p.get(c![k as keyof A11yConfig] as string)) ?? data[k];
        if (n.raw.focus?.enabledInput)
          data.focusEnabled = track(() => p.get(n.raw.focus!.enabledInput!));
        const entry: Entry = {
          p,
          i,
          id: prefix + n.id,
          parent: n.parent < 0 ? parent : prefix + p.model.nodes[n.parent]!.id,
          matrix: m,
          config: c,
          data,
          visible: visible && p.visible(i) && !data.hidden,
          bounds:
            !c?.bounds && runtime.bounds
              ? runtime.bounds(frame.nodes[i]!, m)
              : points.length
                ? box(points.map((pt) => apply(m, ...pt)))
                : undefined,
        };
        entries.push(entry);
        for (const [id, child] of children ?? []) {
          if (id === n.id) {
            track(() => children!.get(id));
            collect(child, prefix + id + '.', entry.id, entry.matrix, entry.visible);
          }
        }
        const lists = modules.get('lists') as
          typeof import('../../lists/core/index.ts').lists | undefined;
        for (const run of (lists?.listState(p)?.runs ?? []).filter((r) => r.spec.node === i)) {
          track(() => run.items.length);
          for (const item of run.items) {
            const index = item.index;
            track(() => run.items[index]?.player);
            const raw = p.model.nodes[run.spec.node]!.raw;
            collect(
              item.player,
              entry.id + '.' + item.index + '.',
              entry.id,
              mul(entry.matrix, [
                1,
                0,
                0,
                1,
                (raw.dx ?? 0) * item.index,
                (raw.dy ?? 0) * item.index,
              ]),
              entry.visible,
            );
          }
        }
      });
    };
    collect(this);
    runtime.enrich?.(entries, track);
    runtime.refine?.(entries);
    const owners = new Map(entries.map((e) => [e.id, e]));
    for (const e of [...entries].reverse()) {
      if (e.bounds) continue;
      const points = entries
        .filter((c) => c.parent === e.id && c.visible && c.bounds)
        .flatMap((c): [number, number][] => {
          const [x, y, w, h] = c.bounds!;
          return [
            [x, y],
            [x + w, y + h],
          ];
        });
      if (points.length) e.bounds = box(points);
    }
    const signature = JSON.stringify([
      runtime.version,
      entries.map((e) => [e.id, e.parent, e.data, e.visible, e.bounds, e.p.focused]),
    ]);
    const valid = () => checks.every((check) => check());
    if (old?.signature === signature) {
      old.entries = entries;
      old.valid = valid;
      return old.tree;
    }
    const nodes = new Map<string, SemanticNode>();
    const tree: SemanticNode[] = [];
    const excluded = new Set<string>();
    // Parents precede descendants, including nested players.
    for (const e of entries) {
      if (!e.visible || excluded.has(e.parent)) {
        excluded.add(e.id);
        continue;
      }
      if (!e.config || e.data.role === 'none') continue;
      const c = e.config,
        d = e.data;
      const n: SemanticNode = {
        id: e.id,
        role: c.role,
        states: {},
        bounds: e.bounds ?? [...apply(e.matrix, 0, 0), 0, 0],
        actions: [],
        children: [],
      };
      for (const key of 'label hint value valueText level href'.split(' '))
        if (d[key] !== undefined) (n as unknown as Record<string, unknown>)[key] = d[key];
      if (c.controls) n.controls = e.id.slice(0, -e.p.model.nodes[e.i]!.id.length) + c.controls;
      if (c.role === 'status') n.states.live = 'polite';
      for (const key of states)
        if (key !== 'hidden' && d[key] !== undefined)
          (n.states as Record<string, unknown>)[key] = d[key];
      if (d.checkedMixed) n.states.checked = 'mixed';
      if (c.live && c.live !== 'off') n.states.live = c.live;
      if ((!d.disabled && c.role === 'slider') || ['progressbar', 'meter'].includes(c.role)) {
        n.min = c.min ?? 0;
        n.max = c.max ?? 100;
        if (c.role === 'slider') n.step = c.step ?? 1;
      }
      let parent = owners.get(e.parent);
      while (parent && !nodes.has(parent.id)) parent = owners.get(parent.parent);
      (parent ? nodes.get(parent.id)!.children : tree).push(n);
      nodes.set(e.id, n);
    }
    const prune = (list: SemanticNode[]) => {
      const modal = list.find((n) => n.states.modal);
      if (modal) list.splice(0, list.length, modal);
      list.forEach((n) => prune(n.children));
    };
    prune(tree);
    const cache = { signature, tree, entries, valid };
    caches.set(this, cache);
    if (runtime.update?.(this, cache, old)) {
      caches.delete(this);
      return this.semantics();
    }
    return tree;
  };
}
export function prepare(model: import('../../../packages/core/src/load.ts').Model) {
  if (!model.doc.requires?.includes('a11y')) return;
  const previous = model.afterStep;
  model.afterStep = (p) => {
    previous?.(p);
    p.semantics();
  };
}
