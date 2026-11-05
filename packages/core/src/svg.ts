// The SVG scene: one element structure per document, attribute values per frame. The web runtime
// builds it as retained DOM; `toSVG` serialises it. Both use exactly these attributes.

import { pathLength } from './path.ts';
import {
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

export type SVGRenderer = (frame: DrawFrame, el: El, paint: Paint, id: string) => Attrs;
export interface SVGBackend {
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
    if (k !== 'kind') {
      const v = g[k as keyof Geometry]!;
      a[k] = k === 'rx' && !v ? null : typeof v === 'number' ? fmt(v) : v;
    }
}
export function paintAttrs(
  fill: DrawPaint | undefined,
  s: DrawPaint | undefined,
  paint: Paint,
  a: Attrs,
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
      pathLength: t ? '1' : null,
      'stroke-dasharray': t && len < 1 ? `${fmt(len)} ${fmt(1 - len)}` : null,
      'stroke-dashoffset': t && len < 1 ? fmt(-((((t.start + t.offset) % 1) + 1) % 1)) : null,
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
      stroke: width > 0 ? '#000' : 'none',
      'stroke-width': fmt(width),
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    });
  }
  paintAttrs(fill, stroke, paint, a);
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
    staticLengths?: boolean;
  } = {},
): string {
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
    if (opts.staticLengths && a.pathLength === '1') {
      let length = 0;
      if (a.d) length = pathLength(a.d);
      else if (el.tag === 'circle') length = 2 * Math.PI * Number(a.r);
      else if (el.tag === 'rect') {
        const w = Number(a.width),
          h = Number(a.height);
        const r = Number(a.rx ?? 0),
          rx = Math.min(r, w / 2),
          ry = Math.min(r, h / 2);
        length =
          2 * (w + h - 2 * rx - 2 * ry) +
          (rx && ry ? 4 * pathLength(`M${rx} 0A${rx} ${ry} 0 0 1 0 ${ry}`) : 0);
      }
      for (const k of ['stroke-dasharray', 'stroke-dashoffset'])
        if (a[k])
          a[k] = a[k]!.split(' ')
            .map((v) => fmt(Number(v) * length))
            .join(' ');
      a.pathLength = null;
    }
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
