// The registry (ARCHITECTURE §core.1): every node type, property and paint field, and the shape of
// every object in a document. Validation, the JSON Schema, `anima schema`, sampling and the
// renderers all read it.

import { text } from './diag.ts';

export type ValueType =
  'number' | 'bool' | 'color' | 'path' | 'int' | 'uint' | 'string' | 'reference';

export interface Prop {
  type: ValueType;
  feature?: string;
  discrete?: boolean;
  /** Default when the document omits it; undefined means the key is required. */
  def?: number | boolean | string;
  /** Range the resolved value is clamped to, and the document value must lie in. */
  min?: number;
  max?: number;
  /** The AniML attribute name, where it differs from the .ani key (spec/ANIML.md §3). */
  markup?: string;
}

const num = (def?: number, min?: number, max?: number): Prop => ({ type: 'number', def, min, max });

/** Animatable properties every node has (spec §4). */
export const COMMON: Record<string, Prop> = {
  x: num(0),
  y: num(0),
  rotate: num(0),
  scale: num(1),
  scaleX: num(1),
  scaleY: num(1),
  opacity: num(1, 0, 1),
  visible: { type: 'bool', def: true },
};

export const NODE_TYPES = ['group', 'path', 'circle', 'rect', 'arc'] as const;
export type NodeType = (typeof NODE_TYPES)[number];
export const PAINTED: readonly NodeType[] = ['path', 'circle', 'rect', 'arc'];

/** Animatable properties per node type. */
export const OWN: Record<NodeType, Record<string, Prop>> = {
  group: {},
  path: {},
  circle: { r: num(undefined, 0) },
  rect: {
    w: { ...num(undefined, 0), markup: 'width' },
    h: { ...num(undefined, 0), markup: 'height' },
    rx: num(0, 0),
  },
  arc: { r: num(undefined, 0), from: num(), to: num() },
};

/** Animatable paint fields, addressed `<id>.fill.<field>` / `<id>.stroke.<field>`. */
export const PAINT: Record<'fill' | 'stroke', Record<string, Prop>> = {
  fill: { color: { type: 'color', markup: 'fill' } },
  stroke: {
    color: { type: 'color', markup: 'stroke' },
    width: { ...num(1, 0), markup: 'stroke-width' },
    trimStart: num(0, 0, 1),
    trimEnd: num(1, 0, 1),
    trimOffset: num(0),
  },
};

// ---------------------------------------------------------------- document shape

/** One entry defines both spellings: `markup` is the AniML name where it differs from the key. */
export type Shape = (
  | { k: 'str'; re?: RegExp; of?: readonly string[] }
  | { k: 'num'; min?: number; max?: number; gt?: number; int?: boolean }
  | { k: 'bool' }
  | { k: 'any' }
  | { k: 'arr'; of: Shape; min?: number }
  | { k: 'tup'; of: Shape[]; min: number }
  | { k: 'obj'; p: Record<string, Shape>; req?: string[]; reserved?: Record<string, string> }
  | { k: 'map'; of: Shape; key?: RegExp }
  | { k: 'alt'; of: Shape[] }
  | { k: 'node' }
) & {
  markup?: string;
  feature?: string;
  element?: string;
  default?: unknown;
  format?: Shape;
  description?: string;
};

/** The AniML attribute name of a key: its `markup` name, or the key itself. */
export const markupName = (s: Shape | Prop | undefined, key: string): string => s?.markup ?? key;

export const NAME = /^[a-z][a-zA-Z0-9-]*$/;
export const DOC_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const S = (re?: RegExp, of?: readonly string[]): Shape => ({ k: 'str', re, of });
const N = (o: { min?: number; max?: number; gt?: number; int?: boolean } = {}): Shape => ({
  k: 'num',
  ...o,
});
const B: Shape = { k: 'bool' };
const A = (of: Shape, min?: number): Shape => ({ k: 'arr', of, min });
const T = (of: Shape[], min = of.length): Shape => ({ k: 'tup', of, min });
const O = (p: Record<string, Shape>, req?: string[], reserved?: Record<string, string>): Shape => ({
  k: 'obj',
  p,
  req,
  reserved,
});
const MAP = (of: Shape, key?: RegExp): Shape => ({ k: 'map', of, key });
const ALT = (...of: Shape[]): Shape => ({ k: 'alt', of });
const VEC2 = T([N(), N()]);
const named = (s: Shape, markup: string): Shape => ({ ...s, markup });
const NAMES = ALT(S(NAME), A(S(NAME), 1));
const propShape = (p: Prop): Shape => {
  const s =
    p.type === 'bool'
      ? B
      : p.type === 'color' || p.type === 'path'
        ? S()
        : N({ min: p.min, max: p.max });
  return { ...s, markup: p.markup, feature: p.feature };
};

// Paint is flattened onto the node in AniML, with SVG's names (spec/ANIML.md §3).
export const FILL = O(
  {
    color: propShape(PAINT.fill.color!),
    rule: named(S(undefined, ['nonzero', 'evenodd']), 'fill-rule'),
  },
  ['color'],
);
export const STROKE = O(
  {
    color: propShape(PAINT.stroke.color!),
    width: propShape(PAINT.stroke.width!),
    cap: named(S(undefined, ['butt', 'round', 'square']), 'stroke-linecap'),
    join: named(S(undefined, ['miter', 'round', 'bevel']), 'stroke-linejoin'),
    trimStart: propShape(PAINT.stroke.trimStart!),
    trimEnd: propShape(PAINT.stroke.trimEnd!),
    trimOffset: N(),
  },
  ['color'],
);

/** Non-animatable keys per node type (beyond `id`, `type`, `pivot`). */
export const STATIC: Record<NodeType, Record<string, Shape>> = {
  group: { children: A({ k: 'node' }) },
  path: { glyph: S(NAME), subpaths: A(N({ min: 0, int: true }), 1), d: S() },
  circle: { center: named(VEC2, 'cx cy') },
  rect: { x0: N(), y0: N() },
  arc: { center: named(VEC2, 'cx cy') },
};

export type ObjShape = Extract<Shape, { k: 'obj' }>;

/** Structural markup supplied by modules; field names still come from shapes. */
export interface ElementForm {
  shape: ObjShape;
  values?: Record<string, string>;
  target?: {
    attribute: string;
    default: string;
    choices: string[];
    array?: boolean;
    wrapper?: string;
    /** Object path below the selected target (for example fill.feather). */
    path?: string[];
  };
}
export const ELEMENTS: Record<string, ElementForm> = {};
const nodeShapes = new Map<NodeType, ObjShape>();
/** The object shape of one node type. */
export function nodeShape(type: NodeType): ObjShape {
  let s = nodeShapes.get(type);
  if (!s) {
    const p: Record<string, Shape> = { id: S(NAME), type: S(undefined, NODE_TYPES), pivot: VEC2 };
    for (const [k, v] of Object.entries({ ...COMMON, ...OWN[type] })) p[k] = propShape(v);
    Object.assign(p, STATIC[type]);
    if (PAINTED.includes(type))
      Object.assign(p, { fill: FILL, stroke: STROKE, knockout: N({ min: 0 }) });
    const req = [
      'id',
      'type',
      ...Object.keys(OWN[type]).filter((k) => OWN[type][k]!.def === undefined),
    ];
    if (type === 'circle' || type === 'arc') req.push('center');
    if (type === 'rect') req.push('x0', 'y0');
    s = { k: 'obj', p, req };
    nodeShapes.set(type, s);
  }
  return s;
}

// Arrays are accepted structurally so that `pivot`/`center` reach the clearer not-animatable error.
const VALUE = ALT(N(), B, S(), A({ k: 'any' }));
export const TRANSITION = O(
  { when: S(), to: S(NAME), blend: N({ min: 0 }), ease: S(), interruptible: B },
  ['when', 'to'],
);
export const STATE = O(
  { pose: MAP(VALUE), play: S(NAME), speed: N({ gt: 0 }), emit: S(NAME), on: A(TRANSITION) },
  undefined,
);
const LAYER = O({ initial: S(NAME), states: MAP(STATE, NAME) }, ['initial', 'states'], {
  mode: text('additive layers arrive in anima 0.2'),
});

export const TIMELINE = O(
  {
    duration: N({ gt: 0 }),
    loop: S(undefined, ['once', 'loop', 'pingpong']),
    reducedMotion: S(undefined, ['play', 'end', 'skip']),
    tracks: MAP(A(T([N(), VALUE, S()], 2))),
    events: A(T([N(), S(NAME)])),
  },
  ['duration', 'tracks'],
  { colorSpace: text('colour interpolation spaces arrive in anima 0.2') },
);

/** The whole document. */
export const DOC: Shape = O(
  {
    $schema: S(),
    anima: S(),
    name: S(DOC_NAME),
    title: S(),
    grid: N({ gt: 0 }),
    viewBox: T([N(), N(), N({ gt: 0 }), N({ gt: 0 })]),
    requires: A(S()),
    meta: { k: 'any' },
    colors: MAP(S(), NAME),
    glyphs: MAP(O({ source: S(), pick: S(), sha256: S(/^[0-9a-f]{64}$/), d: S() }, ['d']), NAME),
    a11y: O({
      role: S(undefined, ['button', 'switch', 'img']),
      label: S(),
      activate: S(NAME),
      pressed: S(NAME),
      held: S(NAME),
    }),
    inputs: MAP(
      O(
        {
          type: named(S(undefined, ['bool', 'number', 'trigger']), 'element name'),
          default: ALT(N(), B),
          min: N(),
          max: N(),
          buffer: N({ min: 0 }),
        },
        ['type'],
      ),
      NAME,
    ),
    hit: O({
      circle: T([N(), N(), N({ gt: 0 })]),
      rect: T([N(), N(), N({ gt: 0 }), N({ gt: 0 })]),
    }),
    nodes: A({ k: 'node' }, 1),
    timelines: MAP(TIMELINE, NAME),
    machine: O({ layers: MAP(LAYER, NAME) }, ['layers']),
    listeners: A(
      O(
        {
          on: S(undefined, ['enter', 'leave', 'down', 'up', 'click', 'move']),
          target: S(NAME),
          hitPadding: N({ min: 0 }),
          fire: NAMES,
          set: MAP(ALT(N(), B, { ...S(), feature: 'bind' }), NAME),
          toggle: NAMES,
          emit: S(NAME),
        },
        ['on'],
      ),
    ),
  },
  ['anima', 'name', 'grid', 'nodes'],
);

// Capture the base tables once. Recomposition preserves the exported table identities used by
// separately bundled modules, while derived node shapes are rebuilt from the complete module set.
const baseTables = [
  OWN,
  STATIC,
  ...Object.values(OWN),
  ...Object.values(STATIC),
  ...Object.values(PAINT),
  (DOC as ObjShape).p,
  (LAYER as ObjShape).p,
  (((DOC as ObjShape).p.listeners as Extract<Shape, { k: 'arr' }>).of as ObjShape).p,
  (TIMELINE as ObjShape).p,
  (STATE as ObjShape).p,
  (TRANSITION as ObjShape).p,
  (FILL as ObjShape).p,
  (STROKE as ObjShape).p,
].map((table) => [table, { ...table }] as const);
const baseTypes = NODE_TYPES.length;
const basePainted = PAINTED.length;
export function resetRegistry(): void {
  for (const [table, base] of baseTables) {
    for (const key of Object.keys(table)) Reflect.deleteProperty(table, key);
    Object.assign(table, base);
  }
  (NODE_TYPES as unknown as string[]).splice(baseTypes);
  (PAINTED as string[]).splice(basePainted);
  nodeShapes.clear();
}
