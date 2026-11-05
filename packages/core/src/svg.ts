// The SVG scene: one element structure per document, attribute values per frame. The web runtime
// builds it as retained DOM; `toSVG` serialises it. Both use exactly these attributes.

import { formatHex } from './color.ts';
import type { Mat } from './geom.ts';
import type { Model } from './load.ts';
import type { Player } from './player.ts';

export interface El {
  tag: string;
  /** node: a document node · wrap: earlier siblings under a knockout's mask · mask/bg/cut: the mask. */
  role: 'node' | 'wrap' | 'mask' | 'bg' | 'cut';
  node: number;
  kids: El[];
}

export type Attrs = Record<string, string | null>;

const SHAPE: Record<string, string> = {
  path: 'path',
  arc: 'path',
  circle: 'circle',
  rect: 'rect',
  group: 'g',
};

/** Build the element tree, plus mask definitions, for a model. */
export function sceneTree(model: Model): { root: El[]; defs: El[] } {
  const defs: El[] = [];
  const build = (list: number[]): El[] => {
    let out: El[] = [];
    for (const i of list) {
      const n = model.nodes[i]!;
      if (n.raw.knockout !== undefined && out.length) {
        out = [{ tag: 'g', role: 'wrap', node: i, kids: out }];
        const tag = SHAPE[n.type]!;
        defs.push({
          tag: 'mask',
          role: 'mask',
          node: i,
          kids: [
            { tag: 'rect', role: 'bg', node: i, kids: [] },
            { tag, role: 'cut', node: i, kids: [] },
          ],
        });
      }
      out.push({
        tag: SHAPE[n.type]!,
        role: 'node',
        node: i,
        kids: n.type === 'group' ? build(n.children) : [],
      });
    }
    return out;
  };
  const roots = model.nodes.flatMap((n, i) => (n.parent < 0 ? [i] : []));
  return { root: build(roots), defs };
}

export const fmt = (v: number): string => String(Math.round(v * 1e5) / 1e5 || 0);

const matrix = (m: Mat): string | null =>
  Math.abs(m[0] - 1) +
    Math.abs(m[1]) +
    Math.abs(m[2]) +
    Math.abs(m[3] - 1) +
    Math.abs(m[4]) +
    Math.abs(m[5]) <
  1e-9
    ? null
    : `matrix(${m.map(fmt).join(' ')})`;

export interface Paint {
  /** How a colour slot renders: as a CSS variable (web) or resolved to a value (static). */
  slot(name: string, def: string): string;
}

export const cssSlots: Paint = { slot: (name, def) => `var(--anima-${name}, ${def})` };
export const staticSlots = (over: Record<string, string> = {}): Paint => ({
  slot: (name, def) => over[name] ?? def,
});

function color(p: Player, i: number, key: string, paint: Paint): string {
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

/** Is a knockout's cut empty (nothing to mask)? Then the wrapper drops its mask. */
export function cutEmpty(p: Player, i: number): boolean {
  if (!p.visible(i) || !(p.num(i, 'opacity', 1) > 0)) return true;
  const m = p.local(i);
  return Math.abs(m[0] * m[3] - m[1] * m[2]) < 1e-12;
}

/** Current attributes of one element. `id` prefixes mask ids so several icons can share a page. */
export function attrs(p: Player, el: El, paint: Paint, id: string): Attrs {
  const i = el.node;
  const n = p.model.nodes[i]!;
  const r = n.raw;
  const a: Attrs = {};
  const op = p.num(i, 'opacity', 1);
  if (el.role === 'wrap') {
    a.mask = cutEmpty(p, i) ? null : `url(#${id}k${i})`;
    return a;
  }
  if (el.role === 'mask' || el.role === 'bg') {
    // The mask and its white background cover three viewBoxes, so cuts may overhang.
    const [x, y, w, h] = p.model.viewBox;
    const box = { x: fmt(x - w), y: fmt(y - h), width: fmt(3 * w), height: fmt(3 * h) };
    return el.role === 'bg'
      ? { ...box, fill: '#fff' }
      : { id: `${id}k${i}`, maskUnits: 'userSpaceOnUse', ...box };
  }
  a.transform = matrix(p.local(i));
  a.display = p.prop(i, 'visible') === false ? 'none' : null;
  if (el.role === 'cut') {
    geometry(p, i, a);
    const grow = 2 * r.knockout;
    const sw = r.stroke ? p.num(i, 'stroke.width', 1) : 0;
    Object.assign(a, {
      fill: r.fill ? '#000' : 'none',
      'fill-rule': r.fill?.rule === 'evenodd' ? 'evenodd' : null,
      stroke: '#000',
      'stroke-width': fmt(sw + grow),
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
      opacity: op < 1 ? fmt(op) : null,
    });
    if (!(sw + grow > 0)) a.stroke = null;
    return a;
  }
  a.opacity = op < 1 ? fmt(op) : null;
  if (n.type === 'group') return a;
  geometry(p, i, a);
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
  const ser = (el: El): string => {
    const a = attrs(p, el, paint, id);
    const at = Object.entries(a)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => ` ${k}="${esc(v!)}"`)
      .join('');
    return el.kids.length
      ? `<${el.tag}${at}>${el.kids.map(ser).join('')}</${el.tag}>`
      : `<${el.tag}${at}/>`;
  };
  const [x, y, w, h] = p.model.viewBox;
  const size =
    (opts.width ? ` width="${opts.width}"` : '') + (opts.height ? ` height="${opts.height}"` : '');
  const bg = opts.background
    ? `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="${esc(opts.background)}"/>`
    : '';
  const used = defs.filter((m) => !cutEmpty(p, m.node));
  const defsText = used.length ? `<defs>${used.map(ser).join('')}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${[x, y, w, h].map(fmt).join(' ')}"${size}>${defsText}${bg}${root.map(ser).join('')}</svg>`;
}
