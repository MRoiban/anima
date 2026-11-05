// Optional modules extend the same registry and the existing sampling/scene pipeline.
import {
  ELEMENTS,
  type ElementForm,
  DOC,
  FILL,
  STROKE,
  PAINT,
  OWN,
  STATIC,
  NODE_TYPES,
  PAINTED,
  nodeShape,
  type NodeType,
  type ObjShape,
  type Prop,
  type Shape,
} from './registry.ts';
import type { Diags } from './diag.ts';
import type { Addr, Model, NodeM, Value } from './load.ts';
import type { Player } from './player.ts';
import type { Attrs, El, Paint } from './svg.ts';

export interface ModuleEntry {
  target: string;
  /** Declare a new node type; load/scene hooks compile or render its geometry. */
  node?: { painted?: boolean };
  shapes: Record<string, Shape>;
  props?: Record<string, Prop>;
  required?: string[];
  elements?: Record<string, ElementForm>;
}
export interface Module {
  name: string;
  init?(): Module;
  crossNode?: boolean;
  entries: ModuleEntry[];
  order?(player: Player, nodes: number[]): number[];
  load?(model: Model, raw: Model['doc'], diag: Diags): void;
  /** Resolve additional addresses to the existing number/colour/bool sampling slots. */
  model?(node: NodeM, key: string): Pick<Addr, 'prop' | 'rest'> | undefined;
  value?(addr: Addr, value: unknown, pointer: string, diag: Diags): Value | undefined;
  outline?(player: Player, node: number): { pts: number[]; closed: boolean }[] | undefined;
  interpolate?(a: Value, b: Value, weight: number): Value | undefined;
  scene?(model: Model, tree: { root: El[]; defs: El[] }): void;
  attrs?(player: Player, el: El, paint: Paint, id: string, attrs: Attrs): void;
}
export const modules = new Map<string, Module>();
export const FEATURES = ['knockout'];

/** Idempotent by name; a versioned module also enables its unversioned feature. */
export function registerModule(m: Module): void {
  if (!/^[a-z]+(?:@[1-9]\d*)?$/.test(m.name)) throw new Error('invalid module name');
  if (modules.has(m.name)) return;
  m = m.init?.() ?? m;
  for (const e of m.entries) {
    const type = e.target as NodeType;
    if (e.node && !NODE_TYPES.includes(type)) {
      (NODE_TYPES as unknown as string[]).push(type);
      OWN[type] = {};
      STATIC[type] = {};
      if (e.node.painted) (PAINTED as string[]).push(type);
    }
    if (NODE_TYPES.includes(type)) {
      for (const [k, v] of Object.entries(e.shapes)) if (!e.props?.[k]) STATIC[type][k] = v;
    }
    if (e.props)
      for (const [k, v] of Object.entries(e.props))
        (PAINT[e.target as 'fill' | 'stroke'] ?? OWN[e.target as NodeType])[k] = {
          ...v,
          feature: m.name,
        };
    const s = (
      e.target === 'fill'
        ? FILL
        : e.target === 'stroke'
          ? STROKE
          : e.target === 'document'
            ? DOC
            : nodeShape(e.target as NodeType)
    ) as ObjShape;
    if (e.node) s.p.type = { ...s.p.type!, feature: m.name };
    for (const [k, v] of Object.entries(e.shapes)) s.p[k] = { ...v, feature: m.name };
    Object.assign(ELEMENTS, e.elements);
    if (e.required) s.req = e.required;
  }
  modules.set(m.name, m);
  FEATURES.push(m.name, ...(m.name.includes('@') ? [m.name.split('@')[0]!] : []));
}
