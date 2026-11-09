// The SVG scene: one element structure per document, attribute values per frame. The web runtime
// builds it as retained DOM; `toSVG` serialises it. Both use exactly these attributes.

import {
  geometryLength,
  drawTree,
  drawFrame,
  drawOrder,
  fmt,
  type DrawTree,
  type DrawFrame,
  type Geometry,
  type DrawColor,
  type DrawPaint,
} from './draw.ts';
export { fmt } from './draw.ts';
import type { Mat } from './geom.ts';
import type { Model } from './load.ts';
import type { Player } from './player.ts';
import { modules } from './modules.ts';

export interface El {
  tag: string;
  text?: string;
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

export type SVGRenderer = (frame: DrawFrame, el: El, paint: Paint, id: string) => Attrs;
export interface SVGBackend {
  // seam(P8-5): tooling-only backend validation; retained DOM never calls this.
  checkStatic?(player: Player): void;
  tree?(draw: DrawTree, tree: { root: El[]; defs: El[] }): void;
  attrs?(
    frame: DrawFrame,
    el: El,
    paint: Paint,
    id: string,
    attrs: Attrs,
    render: SVGRenderer,
  ): void;
}
export const svgBackends = new Map<string, SVGBackend>();
export function registerSVGBackend(name: string, backend: SVGBackend): void {
  svgBackends.set(name, backend);
  // Hooks run in module dependency order (e.g. contour before mix), whatever the load order.
  const order = [...modules.keys()],
    rank = (n: string) => order.indexOf(n.replace('-', '')) >>> 0;
  const sorted = [...svgBackends].sort((a, b) => rank(a[0]) - rank(b[0]));
  svgBackends.clear();
  for (const [n, b] of sorted) svgBackends.set(n, b);
}
/**
 * Build the element tree, plus mask definitions, for a model.
 *
 * Structure rules (they keep every browser's paint invalidation simple; see LOG, Firefox fix):
 * transforms live only on `<g>` wrappers, never on painted leaves; the transform, opacity and
 * display attributes are always present (identity is written out, never removed); and a knockout's
 * mask sits on a wrapper with no transform of its own, attached for the document's whole life.
 */
export function sceneTree(model: Model): { root: El[]; defs: El[] } {
  const draw = drawTree(model);
  const defs: El[] = [];
  const leaf = (i: number, role: 'shape' | 'cut'): El => ({
    tag: draw.nodes[i]!.kind,
    role,
    node: i,
    kids: [],
  });
  const build = (list: number[]): El[] => {
    let out: El[] = [];
    for (const i of list) {
      const n = draw.nodes[i]!;
      if (n.knockout !== undefined && out.length) {
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
        kids: n.kind === 'group' ? build(n.children) : [leaf(i, 'shape')],
      });
    }
    return out;
  };
  const roots = draw.roots;
  const tree = { root: build(roots), defs };
  for (const b of svgBackends.values()) b.tree?.(draw, tree);
  return tree;
}

export function sceneOrder(p: Player, nodes: number[]): number[] {
  return drawOrder(drawFrame(p), nodes);
}

const matrix = (m: Mat): string => `matrix(${m.map(fmt).join(' ')})`;

export interface Paint {
  /** How a colour slot renders: as a CSS variable (web) or resolved to a value (static). */
  slot(name: string, def: string): string;
}

export const cssSlots: Paint = { slot: (name, def) => `var(--anima-${name}, ${def})` };
export const staticSlots = (over: Record<string, string> = {}): Paint => ({
  slot: (name, def) => over[name] ?? def,
});

export function paintColor(value: DrawColor | undefined, paint: Paint): string {
  return typeof value === 'object' ? paint.slot(value.slot, value.fallback) : value!;
}
export function geometryAttrs(g: Geometry | undefined, a: Attrs): void {
  if (!g) return;
  for (const k in g)
    if (k !== 'kind' && k !== 'image') {
      const v = g[k as Exclude<keyof Geometry, 'image'>]!;
      a[k] = k === 'rx' && !v ? null : typeof v === 'number' ? fmt(v) : v;
    }
}
export function paintAttrs(
  fill: DrawPaint | undefined,
  s: DrawPaint | undefined,
  paint: Paint,
  a: Attrs,
  length = 1,
): void {
  a.fill = fill ? paintColor(fill.color, paint) : 'none';
  a['fill-rule'] = fill?.rule === 'evenodd' ? 'evenodd' : null;
  if (s) {
    const t = s.trim;
    const len = Math.min(1, (t?.end ?? 1) - (t?.start ?? 0));
    Object.assign(a, {
      stroke: len > 0 ? paintColor(s.color, paint) : 'none',
      'stroke-width': fmt(s.width!),
      'stroke-linecap': s.cap!,
      'stroke-linejoin': s.join!,
      pathLength: null,
      'stroke-dasharray': t && len < 1 ? `${fmt(len * length)} ${fmt((1 - len) * length)}` : null,
      'stroke-dashoffset':
        t && len < 1 ? fmt(-((((t.start + t.offset) % 1) + 1) % 1) * length) : null,
    });
  }
}
/** Current attributes of one element. `id` prefixes mask ids so several icons can share a page. */
export function attrs(p: Player | DrawFrame, el: El, paint: Paint, id: string): Attrs {
  return svgAttrs('tree' in p ? p : drawFrame(p), el, paint, id);
}
export function svgAttrs(f: DrawFrame, el: El, paint: Paint, id: string): Attrs {
  const a = coreAttrs(f, el, paint, id);
  for (const b of svgBackends.values()) b.attrs?.(f, el, paint, id, a, svgAttrs);
  return a;
}
function coreAttrs(f: DrawFrame, el: El, paint: Paint, id: string): Attrs {
  if (el.role.startsWith('module:')) return {};
  const i = el.node,
    n = f.nodes[i]!,
    entry = f.tree.nodes[i]!;
  if (el.role === 'wrap') return { mask: `url(#${id}k${i})` };
  if (el.role === 'mask' || el.role === 'bg') {
    const [x, y, w, h] = f.viewBox;
    const box = { x: fmt(x - w), y: fmt(y - h), width: fmt(3 * w), height: fmt(3 * h) };
    return el.role === 'bg'
      ? { ...box, fill: '#fff' }
      : { id: `${id}k${i}`, maskUnits: 'userSpaceOnUse', ...box };
  }
  if (el.role === 'node' || el.role === 'cutg')
    return {
      transform: matrix(n.transform),
      opacity: fmt(n.opacity),
      display: n.visible ? 'inline' : 'none',
    };
  const a: Attrs = {};
  geometryAttrs(n.geometry, a);
  const fill = n.paints.find((p) => p.kind === 'fill'),
    stroke = n.paints.find((p) => p.kind === 'stroke');
  if (el.role === 'cut') {
    const width = (stroke?.width ?? 0) + 2 * entry.knockout!;
    return Object.assign(a, {
      fill: fill ? '#000' : 'none',
      'fill-rule': fill?.rule === 'evenodd' ? 'evenodd' : null,
      // A node with neither paint draws nothing, so it cuts nothing (spec §4).
      stroke: width > 0 && (fill || stroke) ? '#000' : 'none',
      'stroke-width': fmt(width),
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    });
  }
  paintAttrs(
    fill,
    stroke,
    paint,
    a,
    stroke?.trim && stroke.trim.end - stroke.trim.start < 1 ? geometryLength(n.geometry, entry) : 1,
  );
  return a;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Serialise the player's current frame to a standalone SVG document. */
export function toSVG(
  p: Player,
  opts: {
    paint?: Paint;
    width?: number;
    height?: number;
    background?: string;
    id?: string;
    /** Compatibility option: all SVG output now uses natural local lengths. */
    staticLengths?: boolean;
  } = {},
): string {
  // seam(P8-5): optional static-export diagnostics stay outside browser draw paths.
  for (const backend of svgBackends.values()) backend.checkStatic?.(p);
  const paint = opts.paint ?? staticSlots();
  const id = opts.id ?? 'a';
  const { root, defs } = sceneTree(p.model);
  const frame = drawFrame(p);
  const ordered = (els: El[]): El[] => {
    if (new Set(els.map((el) => el.node)).size !== els.length) return els;
    const out = sceneOrder(
      p,
      els.map((el) => el.node),
    );
    return out.map((i) => els.find((el) => el.node === i)!);
  };
  const ser = (el: El): string => {
    const a = svgAttrs(frame, el, paint, id);
    const at = Object.entries(a)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => ` ${k}="${esc(v!)}"`)
      .join('');
    if (el.text !== undefined) return `<${el.tag}${at}>${esc(el.text)}</${el.tag}>`;
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
