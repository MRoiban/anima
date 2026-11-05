// The two spellings, from one registry (spec/ANIML.md §3): which AniML attribute carries which `.ani`
// key on a node, and how animation addresses translate. Compiler and decompiler both use this.

import {
  COMMON,
  NODE_TYPES,
  type NodeType,
  OWN,
  PAINTED,
  type Shape,
  STATIC,
  markupName,
  nodeShape,
} from '@anima-format/core';

/** Where a node attribute lives in `.ani`: a key path, and for `cx`/`cy` an index into `center`. */
export interface NodeAttr {
  /** AniML attribute name. */
  attr: string;
  /** `.ani` key path on the node: `['x']`, `['fill', 'color']`, `['center']`. */
  path: string[];
  /** Index into a vector key (`cx` → 0, `cy` → 1). */
  index?: number;
  /** The registry shape of the `.ani` value. */
  shape: Shape;
  /** Animatable, so usable in `<track target>` and `<pose>`. */
  animatable: boolean;
}

const GEOMETRY: Record<NodeType, string[]> = {
  group: [],
  path: ['glyph', 'subpaths', 'd'],
  circle: ['center', 'r'],
  rect: ['x0', 'y0', 'w', 'h', 'rx'],
  arc: ['center', 'r', 'from', 'to'],
};
const TRANSFORM = ['pivot', 'x', 'y', 'rotate', 'scale', 'scaleX', 'scaleY', 'opacity', 'visible'];
const PAINT_KEYS: [string, string][] = [
  ['fill', 'color'],
  ['fill', 'rule'],
  ['stroke', 'color'],
  ['stroke', 'width'],
  ['stroke', 'cap'],
  ['stroke', 'join'],
  ['stroke', 'trimStart'],
  ['stroke', 'trimEnd'],
  ['stroke', 'trimOffset'],
];

const cache = new Map<NodeType, NodeAttr[]>();

/** The attributes a node element takes, in canonical order (after `id`). */
export function nodeAttrs(type: NodeType): NodeAttr[] {
  let out = cache.get(type);
  if (out) return out;
  out = [];
  const ns = nodeShape(type);
  const animatable = (k: string) => k in COMMON || k in OWN[type];
  for (const key of [...GEOMETRY[type], ...TRANSFORM]) {
    const shape = ns.p[key]!;
    const name = markupName(shape, key);
    const parts = name.split(' ');
    // A vector key spelled as several attributes (center → cx cy).
    if (parts.length > 1)
      parts.forEach((attr, index) =>
        out!.push({ attr, path: [key], index, shape, animatable: false }),
      );
    else out.push({ attr: name, path: [key], shape, animatable: animatable(key) });
  }
  if (PAINTED.includes(type)) {
    for (const [paint, field] of PAINT_KEYS) {
      const obj = ns.p[paint] as Extract<Shape, { k: 'obj' }>;
      const shape = obj.p[field]!;
      out.push({
        attr: markupName(shape, field),
        path: [paint, field],
        shape,
        animatable: !['rule', 'cap', 'join'].includes(field),
      });
    }
    out.push({ attr: 'knockout', path: ['knockout'], shape: ns.p.knockout!, animatable: false });
  }
  cache.set(type, out);
  return out;
}

/** Keys of a node object that `nodeAttrs` does not cover (handled structurally). */
export const STRUCTURAL_NODE_KEYS = ['id', 'type', 'children'];

/** Node element names: one per node type. */
export const NODE_ELEMENTS: readonly string[] = NODE_TYPES;

/**
 * `<id>.<attr>` (markup) → `<id>.<key path>` (`.ani`), or undefined if the attribute is not an
 * animatable node attribute (the caller passes the address through so the loader reports it).
 */
export function aniAddress(
  address: string,
  typeOf: (id: string) => NodeType | undefined,
): string | undefined {
  const dot = address.indexOf('.');
  if (dot < 0) return undefined;
  const type = typeOf(address.slice(0, dot));
  if (!type) return undefined;
  const a = nodeAttrs(type).find((x) => x.attr === address.slice(dot + 1) && x.index === undefined);
  return a ? `${address.slice(0, dot)}.${a.path.join('.')}` : undefined;
}

/** `<id>.<key path>` (`.ani`) → `<id>.<attr>` (markup); unchanged when there is no node attribute for it. */
export function markupAddress(
  address: string,
  typeOf: (id: string) => NodeType | undefined,
): string {
  const dot = address.indexOf('.');
  if (dot < 0) return address;
  const type = typeOf(address.slice(0, dot));
  if (!type) return address;
  const key = address.slice(dot + 1);
  const a = nodeAttrs(type).find((x) => x.path.join('.') === key && x.index === undefined);
  return a ? `${address.slice(0, dot)}.${a.attr}` : address;
}

// Re-exported for the compiler's "did you mean" hints over node attributes.
export { STATIC };
