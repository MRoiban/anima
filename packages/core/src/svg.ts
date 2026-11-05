// The SVG scene: one element structure per document, attribute values per frame. The web runtime
// builds it as retained DOM; `toSVG` serialises it. Both use exactly these attributes.

import { modules } from './modules.ts';
import { formatHex } from './color.ts';
import type { Mat } from './geom.ts';
import type { Model } from './load.ts';
import type { Player } from './player.ts';

export interface El {
  tag: string;
  /**
   * node: a `<g>` carrying one document node's transform, opacity and visibility · shape: the node's
   * untransformed painted element inside it · wrap: earlier siblings under a knockout's mask ·
   * mask, bg, cutg (the cut's transform group) and cut: the mask.
   */
  role: string;
  key?: string;
  index?: number;
  node: number;
  kids: El[];
}

export type Attrs = Record<string, string | null>;

const SHAPE: Record<string, string> = { path: 'path', arc: 'path', circle: 'circle', rect: 'rect' };

/**
 * Build the element tree, plus mask definitions, for a model.
 *
 * Structure rules (they keep every browser's paint invalidation simple; see LOG, Firefox fix):
 * transforms live only on `<g>` wrappers, never on painted leaves; the transform, opacity and
 * display attributes are always present (identity is written out, never removed); and a knockout's
 * mask sits on a wrapper with no transform of its own, attached for the document's whole life.
 */
export function sceneTree(model: Model): { root: El[]; defs: El[] } {
  const defs: El[] = [];
  const leaf = (i: number, role: 'shape' | 'cut'): El => ({
    tag: SHAPE[model.nodes[i]!.type]!,
    role,
    node: i,
    kids: [],
  });
  const build = (list: number[]): El[] => {
    let out: El[] = [];
    for (const i of list) {
      const n = model.nodes[i]!;
      if (n.raw.knockout !== undefined && out.length) {
        out = [{ tag: 'g', role: 'wrap', node: i, kids: out }];
        defs.push({
          tag: 'mask',
          role: 'mask',
          node: i,
          kids: [
            { tag: 'rect', role: 'bg', node: i, kids: [] },
            { tag: 'g', role: 'cutg', node: i, kids: [leaf(i, 'cut')] },
          ],
        });
      }
      out.push({
        tag: 'g',
        role: 'node',
        node: i,
        kids: n.type === 'group' ? build(n.children) : [leaf(i, 'shape')],
      });
    }
    return out;
  };
  const roots = model.nodes.flatMap((n, i) => (n.parent < 0 ? [i] : []));
  const tree = { root: build(roots), defs };
  for (const m of modules.values()) m.scene?.(model, tree);
  return tree;
}

export function sceneOrder(p: Player, nodes: number[]): number[] {
  for (const m of modules.values()) nodes = m.order?.(p, nodes) ?? nodes;
  return nodes;
}

export const fmt = (v: number): string => String(Math.round(v * 1e5) / 1e5 || 0);

const matrix = (m: Mat): string => `matrix(${m.map(fmt).join(' ')})`;

export interface Paint {
  /** How a colour slot renders: as a CSS variable (web) or resolved to a value (static). */
  slot(name: string, def: string): string;
}

export const cssSlots: Paint = { slot: (name, def) => `var(--anima-${name}, ${def})` };
export const staticSlots = (over: Record<string, string> = {}): Paint => ({
  slot: (name, def) => over[name] ?? def,
});

export function color(p: Player, i: number, key: string, paint: Paint): string {
  const v = p.prop(i, key);
  if (Array.isArray(v)) return formatHex(v);
  const s = v as string;
  const slots = p.model.colors;
  return Object.hasOwn(slots, s) ? paint.slot(s, slots[s]!) : s;
}

function geometry(p: Player, i: number, a: Attrs): void {
  const n = p.model.nodes[i]!;
  const r = n.raw;
  const num = (k: string) => p.num(i, k, 0);
  if (n.type === 'path') a.d = n.d!;
  else if (n.type === 'circle')
    [a.cx, a.cy, a.r] = [fmt(r.center[0]), fmt(r.center[1]), fmt(num('r'))];
  else if (n.type === 'rect')
    [a.x, a.y, a.width, a.height, a.rx] = [
      fmt(r.x0),
      fmt(r.y0),
      fmt(num('w')),
      fmt(num('h')),
      num('rx') ? fmt(num('rx')) : null,
    ];
  else if (n.type === 'arc') {
    const [cx, cy] = r.center;
    const rad = num('r');
    let from = num('from');
    const sweep = Math.min(360, Math.max(0, num('to') - from));
    const pt = (deg: number) =>
      `${fmt(cx + rad * Math.cos((deg * Math.PI) / 180))} ${fmt(cy + rad * Math.sin((deg * Math.PI) / 180))}`;
    let d = `M${pt(from)}`;
    // Full circles need two arcs; anything over 180° sets the large-arc flag.
    for (const part of sweep > 180 ? [sweep / 2, sweep / 2] : [sweep]) {
      from += part;
      d += `A${fmt(rad)} ${fmt(rad)} 0 0 1 ${pt(from)}`;
    }
    a.d = d;
  }
}

/** Current attributes of one element. `id` prefixes mask ids so several icons can share a page. */
export function attrs(p: Player, el: El, paint: Paint, id: string): Attrs {
  const a = coreAttrs(p, el, paint, id);
  for (const m of modules.values()) m.attrs?.(p, el, paint, id, a);
  return a;
}

function coreAttrs(p: Player, el: El, paint: Paint, id: string): Attrs {
  if (el.role.startsWith('module:')) return {};
  const i = el.node;
  const r = p.model.nodes[i]!.raw;
  if (el.role === 'wrap') return { mask: `url(#${id}k${i})` };
  if (el.role === 'mask' || el.role === 'bg') {
    // The mask and its white background cover three viewBoxes, so cuts may overhang.
    const [x, y, w, h] = p.model.viewBox;
    const box = { x: fmt(x - w), y: fmt(y - h), width: fmt(3 * w), height: fmt(3 * h) };
    return el.role === 'bg'
      ? { ...box, fill: '#fff' }
      : { id: `${id}k${i}`, maskUnits: 'userSpaceOnUse', ...box };
  }
  if (el.role === 'node' || el.role === 'cutg')
    return {
      transform: matrix(p.local(i)),
      opacity: fmt(p.num(i, 'opacity', 1)),
      display: p.prop(i, 'visible') === false ? 'none' : 'inline',
    };
  const a: Attrs = {};
  geometry(p, i, a);
  if (el.role === 'cut') {
    const sw = r.stroke ? p.num(i, 'stroke.width', 1) : 0;
    const width = sw + 2 * r.knockout;
    return Object.assign(a, {
      fill: r.fill ? '#000' : 'none',
      'fill-rule': r.fill?.rule === 'evenodd' ? 'evenodd' : null,
      stroke: width > 0 ? '#000' : 'none',
      'stroke-width': fmt(width),
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    });
  }
  a.fill = r.fill ? color(p, i, 'fill.color', paint) : 'none';
  a['fill-rule'] = r.fill?.rule === 'evenodd' ? 'evenodd' : null;
  const s = r.stroke;
  if (s) {
    const start = p.num(i, 'stroke.trimStart', 0);
    const to = p.num(i, 'stroke.trimOffset', 0);
    const len = Math.min(1, p.num(i, 'stroke.trimEnd', 1) - start);
    const trimmed = ['trimStart', 'trimEnd', 'trimOffset'].some(
      (k) => k in s || p.prop(i, 'stroke.' + k) !== undefined,
    );
    Object.assign(a, {
      stroke: len > 0 ? color(p, i, 'stroke.color', paint) : 'none',
      'stroke-width': fmt(p.num(i, 'stroke.width', 1)),
      'stroke-linecap': s.cap ?? 'round',
      'stroke-linejoin': s.join ?? 'round',
      pathLength: trimmed ? '1' : null,
      'stroke-dasharray': trimmed && len < 1 ? `${fmt(len)} ${fmt(1 - len)}` : null,
      'stroke-dashoffset': trimmed && len < 1 ? fmt(-((((start + to) % 1) + 1) % 1)) : null,
    });
  }
  return a;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Serialise the player's current frame to a standalone SVG document. */
export function toSVG(
  p: Player,
  opts: { paint?: Paint; width?: number; height?: number; background?: string; id?: string } = {},
): string {
  const paint = opts.paint ?? staticSlots();
  const id = opts.id ?? 'a';
  const { root, defs } = sceneTree(p.model);
  const ordered = (els: El[]): El[] => {
    if (new Set(els.map((el) => el.node)).size !== els.length) return els;
    const out = sceneOrder(
      p,
      els.map((el) => el.node),
    );
    return out.map((i) => els.find((el) => el.node === i)!);
  };
  const ser = (el: El): string => {
    const a = attrs(p, el, paint, id);
    const at = Object.entries(a)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => ` ${k}="${esc(v!)}"`)
      .join('');
    return el.kids.length
      ? `<${el.tag}${at}>${ordered(el.kids).map(ser).join('')}</${el.tag}>`
      : `<${el.tag}${at}/>`;
  };
  const [x, y, w, h] = p.model.viewBox;
  const size =
    (opts.width ? ` width="${opts.width}"` : '') + (opts.height ? ` height="${opts.height}"` : '');
  const bg = opts.background
    ? `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="${esc(opts.background)}"/>`
    : '';
  const defsText = defs.length ? `<defs>${defs.map(ser).join('')}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${[x, y, w, h].map(fmt).join(' ')}"${size}>${defsText}${bg}${ordered(root).map(ser).join('')}</svg>`;
}
