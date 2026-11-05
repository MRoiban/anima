// Renderer-neutral draw data. No DOM, CSS attributes, element tags or renderer callbacks.
import { formatHex } from './color.ts';
import type { Mat } from './geom.ts';
import type { Model } from './load.ts';
import { modules } from './modules.ts';
import type { Player } from './player.ts';

export type DrawColor = string | { slot: string; fallback: string };
export interface DrawPaint {
  kind: 'fill' | 'stroke';
  key?: string;
  color?: DrawColor;
  type?: 'linear' | 'radial';
  coordinates?: Record<string, number>;
  stops?: { position: number; color: DrawColor }[];
  rule?: string;
  visible: boolean;
  width?: number;
  cap?: string;
  join?: string;
  trim?: { start: number; end: number; offset: number };
  dash?: number[];
  /** Authored fractions retained as neutral unit metadata for normalized SVG output. */
  dashNormalized?: number[];
  dashOffsetNormalized?: number;
  dashOffset?: number;
  scale?: string;
  position?: string;
}
export interface Geometry {
  kind: string;
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rx?: number;
}
export interface DrawEntry {
  node: number;
  kind: string;
  parent: number;
  children: number[];
  /** Node slots whose changes invalidate this entry (including spatial sources). */
  dependencies?: number[];
  knockout?: number;
  blend?: string;
  mask?: DrawNode['mask'];
  clip?: DrawNode['clip'];
  paints?: DrawPaint[];
  position?: string;
}
export interface DrawTree {
  nodes: DrawEntry[];
  roots: number[];
  resources: { node: number; kind: string; key?: string; source?: number; paint?: DrawPaint }[];
}
export interface DrawNode {
  transform: Mat;
  world?: Mat;
  opacity: number;
  visible: boolean;
  geometry?: Geometry;
  paints: DrawPaint[];
  blend?: string;
  mask?: { source: number; mode: string; sourceDraws: boolean };
  clip?: { source: number; rule: string };
}
export interface DrawFrame {
  /** Resolved sibling ranks, indexed by node. Absent means authored order. */
  order?: number[];
  revision: number;
  tree: DrawTree;
  nodes: DrawNode[];
  viewBox: Model['viewBox'];
  /** Entries whose resolved drawing changed since the preceding frame. */
  changed: number[];
}
export function drawTree(model: Model): DrawTree {
  let tree = model.draw;
  if (!tree) {
    tree = {
      nodes: model.nodes.map((n, node) => ({
        node,
        kind: n.type === 'arc' ? 'path' : n.type,
        parent: n.parent,
        children: n.children,
        knockout: n.raw.knockout,
      })),
      roots: model.nodes.flatMap((n, i) => (n.parent < 0 ? [i] : [])),
      resources: [],
    };
    model.drawModules = [...modules.values()].filter(
      (m) =>
        model.doc.requires?.includes(m.name) || model.doc.requires?.includes(m.name.split('@')[0]),
    );
    for (const m of model.drawModules) m.draw?.tree?.(model, tree);
    model.draw = tree;
  }
  return tree;
}
export const drawColor = (p: Player, value: unknown): DrawColor => {
  if (Array.isArray(value)) return formatHex(value as import('./color.ts').RGBA);
  const name = value as string;
  return Object.hasOwn(p.model.colors, name)
    ? { slot: name, fallback: p.model.colors[name]! }
    : name;
};
export function drawPaint(
  p: Player,
  i: number,
  kind: 'fill' | 'stroke',
  key: string = kind,
  raw = p.model.nodes[i]!.raw[kind],
): DrawPaint | undefined {
  if (!raw) return;
  const num = (k: string, def: number) => p.num(i, key + '.' + k, def);
  return {
    kind,
    key,
    color: drawColor(p, p.prop(i, key + '.color')),
    rule: raw.rule,
    visible: true,
    ...(kind === 'stroke'
      ? {
          width: num('width', 1),
          cap: raw.cap ?? 'round',
          join: raw.join ?? 'round',
          trim: ['trimStart', 'trimEnd', 'trimOffset'].some(
            (k) => k in raw || p.prop(i, key + '.' + k) !== undefined,
          )
            ? { start: num('trimStart', 0), end: num('trimEnd', 1), offset: num('trimOffset', 0) }
            : undefined,
        }
      : {}),
  };
}
export const fmt = (v: number): string => String(Math.round(v * 1e5) / 1e5 || 0);
function geometry(p: Player, i: number): Geometry | undefined {
  const n = p.model.nodes[i]!,
    r = n.raw;
  const num = (k: string) => p.num(i, k, 0);
  if (n.type === 'path') return { kind: 'path', d: n.d! };
  if (n.type === 'circle') return { kind: 'circle', cx: r.center[0], cy: r.center[1], r: num('r') };
  if (n.type === 'rect')
    return { kind: 'rect', x: r.x0, y: r.y0, width: num('w'), height: num('h'), rx: num('rx') };
  if (n.type === 'arc') {
    const [cx, cy] = r.center,
      rad = num('r');
    let from = num('from');
    const sweep = Math.min(360, Math.max(0, num('to') - from));
    const pt = (deg: number) =>
      `${fmt(cx + rad * Math.cos((deg * Math.PI) / 180))} ${fmt(cy + rad * Math.sin((deg * Math.PI) / 180))}`;
    let d = `M${pt(from)}`;
    for (const part of sweep > 180 ? [sweep / 2, sweep / 2] : [sweep]) {
      from += part;
      d += `A${fmt(rad)} ${fmt(rad)} 0 0 1 ${pt(from)}`;
    }
    return { kind: 'path', d };
  }
}
export function drawFrame(p: Player): DrawFrame {
  const f = (p.drawData ??= {
    revision: -1,
    tree: drawTree(p.model),
    nodes: [],
    viewBox: p.model.viewBox,
    changed: [],
  });
  if (f.revision === p.drawRevision) return f;
  f.changed = [];
  for (let i = 0; i < p.model.nodes.length; i++) {
    const dependencies = f.tree.nodes[i]!.dependencies ?? [i];
    if (dependencies.every((n) => p.drawVersions[n]! <= f.revision)) continue;
    const data: DrawNode = {
      transform: p.local(i),
      opacity: p.num(i, 'opacity', 1),
      visible: p.prop(i, 'visible') !== false,
      geometry: geometry(p, i),
      paints: [],
    };
    for (const kind of ['fill', 'stroke'] as const) {
      const paint = drawPaint(p, i, kind);
      if (paint) data.paints.push(paint);
    }
    for (const m of p.model.drawModules!) m.draw?.frame?.(p, i, data, f.tree.nodes[i]!, f);
    f.nodes[i] = data;
    f.changed.push(i);
  }
  f.revision = p.drawRevision;
  return f;
}
export function drawOrder(f: DrawFrame, nodes: number[]): number[] {
  return [...nodes].sort((a, b) => (f.order?.[a] ?? a) - (f.order?.[b] ?? b));
}
