// Optional modules extend the same registry and the existing sampling/draw pipeline.
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
import type { DrawTree, DrawNode, DrawEntry, DrawFrame } from './draw.ts';

export interface ModuleEntry {
  target: string;
  /** Declare a new node type; load/draw hooks compile or resolve its geometry. */
  node?: { painted?: boolean };
  shapes: Record<string, Shape>;
  props?: Record<string, Prop>;
  required?: string[];
  elements?: Record<string, ElementForm>;
}
export interface ModuleRegistry {
  PAINTED: typeof PAINTED;
  FILL: typeof FILL;
  STROKE: typeof STROKE;
  PAINT: typeof PAINT;
}
export interface Module {
  name: string;
  init?(registry: ReadonlyMap<string, Module>, shapes: ModuleRegistry): Module;
  entries: ModuleEntry[];
  load?(model: Model, raw: Model['doc'], diag: Diags): void;
  /** Resolve additional addresses to the existing number/colour/bool sampling slots. */
  model?(node: NodeM, key: string): Pick<Addr, 'prop' | 'rest'> | undefined;
  value?(addr: Addr, value: unknown, pointer: string, diag: Diags): Value | undefined;
  outline?(player: Player, node: number): { pts: number[]; closed: boolean }[] | undefined;
  interpolate?(a: Value, b: Value, weight: number): Value | undefined;
  draw?: {
    tree?(model: Model, tree: DrawTree): void;
    frame?(player: Player, node: number, data: DrawNode, entry: DrawEntry, frame: DrawFrame): void;
  };
}
export const modules = new Map<string, Module>();
export const FEATURES = ['knockout'];

/** Idempotent by name; a versioned module also enables its unversioned feature. */
export function registerModule(m: Module): void {
  if (!/^[a-z]+(?:@[1-9]\d*)?$/.test(m.name)) throw new Error('invalid module name');
  if (modules.has(m.name)) return;
  m = m.init?.(modules, { PAINTED, FILL, STROKE, PAINT }) ?? m;
  for (const e of m.entries) {
    const targets =
      e.target === 'node' ? NODE_TYPES : e.target === 'painted' ? PAINTED : [e.target];
    for (const target of targets) applyEntry(m, e, target);
  }
  modules.set(m.name, m);
  FEATURES.push(m.name, ...(m.name.includes('@') ? [m.name.split('@')[0]!] : []));
}

function applyEntry(m: Module, e: ModuleEntry, target: string): void {
  const type = target as NodeType;
  if (e.node && !NODE_TYPES.includes(type)) {
    (NODE_TYPES as unknown as string[]).push(type);
    OWN[type] = {};
    STATIC[type] = {};
    if (e.node.painted) (PAINTED as string[]).push(type);
    for (const previous of modules.values())
      for (const entry of previous.entries)
        if (entry.target === 'node' || (entry.target === 'painted' && e.node.painted))
          applyEntry(previous, entry, type);
  }
  if (NODE_TYPES.includes(type)) {
    for (const [k, v] of Object.entries(e.shapes)) if (!e.props?.[k]) STATIC[type][k] = v;
  }
  if (e.props)
    for (const [k, v] of Object.entries(e.props))
      (PAINT[target as 'fill' | 'stroke'] ?? OWN[target as NodeType])[k] = {
        ...v,
        feature: m.name,
      };
  const s = (
    target === 'fill'
      ? FILL
      : target === 'stroke'
        ? STROKE
        : target === 'document'
          ? DOC
          : nodeShape(target as NodeType)
  ) as ObjShape;
  if (e.node) s.p.type = { ...s.p.type!, feature: m.name };
  for (const [k, v] of Object.entries(e.shapes)) s.p[k] = { ...v, feature: m.name };
  Object.assign(ELEMENTS, e.elements);
  if (e.required) s.req = e.required;
}
