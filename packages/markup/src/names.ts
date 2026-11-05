import '@anima-format/core/all';
// The two spellings, from one registry (spec/ANIML.md §3): which AniML attribute carries which `.ani`
// key on a node, and how animation addresses translate. Compiler and decompiler both use this.

import {
  COMMON,
  NODE_TYPES,
  type NodeType,
  OWN,
  PAINT,
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

const TRANSFORM = 'pivot x y rotate scale scaleX scaleY opacity visible'.split(' ');

/** The attributes a node element takes, in canonical order (after `id`). */
export function nodeAttrs(type: NodeType): NodeAttr[] {
  const out: NodeAttr[] = [];
  const ns = nodeShape(type);
  const animatable = (k: string) => k in COMMON || k in OWN[type];
  for (const key of new Set([
    ...Object.keys(STATIC[type]).filter((k) => k !== 'children'),
    ...Object.keys(OWN[type]),
    ...TRANSFORM,
  ])) {
    const shape = ns.p[key]!;
    if (shape.element) continue;
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
    for (const paint of ['fill', 'stroke']) {
      for (const field of Object.keys((ns.p[paint] as Extract<Shape, { k: 'obj' }>).p)) {
        const obj = ns.p[paint] as Extract<Shape, { k: 'obj' }>;
        const shape = obj.p[field]!;
        if (shape.element) continue;
        out.push({
          attr: markupName(shape, field),
          path: [paint, field],
          shape,
          animatable: field in PAINT[paint as 'fill' | 'stroke'],
        });
      }
    }
    out.push({ attr: 'knockout', path: ['knockout'], shape: ns.p.knockout!, animatable: false });
  }
  return out;
}

/** Keys of a node object that `nodeAttrs` does not cover (handled structurally). */
export const STRUCTURAL_NODE_KEYS = [
  'id',
  'type',
  'children',
  ...Object.keys(STATIC.group).filter((k) => nodeShape('group').p[k]?.element),
  'paints',
];

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
