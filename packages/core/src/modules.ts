// Optional modules extend the same registry and the existing sampling/draw pipeline.
import {
  resetRegistry,
  TIMELINE,
  STATE,
  TRANSITION,
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
import { load, resolveAddress, type Addr, type Model, type NodeM, type Value } from './load.ts';
import { Player, sampleTrack, mixValues } from './player.ts';
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
  DOC: typeof DOC;
  nodeShape: typeof nodeShape;
  load: typeof load;
  Player: typeof Player;
  sampleTrack: typeof sampleTrack;
  mixValues: typeof mixValues;
  resolveAddress: typeof resolveAddress;
  PAINTED: typeof PAINTED;
  FILL: typeof FILL;
  STROKE: typeof STROKE;
  PAINT: typeof PAINT;
}
export interface Module {
  name: string;
  /** Ordering constraints among the modules present, not implicit imports. */
  after?: readonly string[];
  init?(registry: ReadonlyMap<string, Module>, shapes: ModuleRegistry): Module;
  entries: ModuleEntry[];
  ease?(source: string, pointer: string, diag: Diags): import('./ease.ts').EaseFn | undefined;
  track?(
    track: import('./load.ts').TrackM,
    addr: Addr,
    keys: unknown[][],
    pointer: string,
    diag: Diags,
  ): void;
  resolve?(model: Model, diag: Diags): void;
  load?(model: Model, raw: Model['doc'], diag: Diags): void;
  /** Resolve additional addresses to the existing number/colour/bool sampling slots. */
  model?(node: NodeM, key: string): Pick<Addr, 'prop' | 'rest'> | undefined;
  value?(addr: Addr, value: unknown, pointer: string, diag: Diags): Value | undefined;
  outline?(player: Player, node: number): { pts: number[]; closed: boolean }[] | undefined;
  interpolate?(a: Value, b: Value, weight: number): Value | undefined;
  draw?: {
    end?(player: Player, frame: DrawFrame): void;
    tree?(model: Model, tree: DrawTree): void;
    frame?(player: Player, node: number, data: DrawNode, entry: DrawEntry, frame: DrawFrame): void;
  };
}
export const modules = new Map<string, Module>();
export const FEATURES = ['knockout'];

const declarations = new Map<string, Module>();

/** Idempotent by name; compose from declarations, independent of arrival order. */
export function registerModule(m: Module): void {
  if (!/^[a-z]+(?:@[1-9]\d*)?$/.test(m.name)) throw new Error('invalid module name');
  if (declarations.has(m.name)) return;
  declarations.set(m.name, m);
  const pending = new Map([...declarations].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const ordered: Module[] = [];
  while (pending.size) {
    const ready = [...pending.values()].find((m) =>
      (m.after ?? []).every((name) => !pending.has(name)),
    );
    if (!ready) {
      declarations.delete(m.name);
      throw new Error('module dependency cycle');
    }
    ordered.push(ready);
    pending.delete(ready.name);
  }
  resetRegistry();
  for (const key of Object.keys(ELEMENTS)) Reflect.deleteProperty(ELEMENTS, key);
  modules.clear();
  FEATURES.splice(1);
  for (let module of ordered) {
    module =
      module.init?.(modules, {
        DOC,
        nodeShape,
        PAINTED,
        FILL,
        STROKE,
        PAINT,
        resolveAddress,
        load,
        Player,
        sampleTrack,
        mixValues,
      }) ?? module;
    modules.set(module.name, module);
    FEATURES.push(module.name, ...(module.name.includes('@') ? [module.name.split('@')[0]!] : []));
    for (const e of module.entries) {
      const targets =
        e.target === 'node' ? NODE_TYPES : e.target === 'painted' ? PAINTED : [e.target];
      for (const target of targets) applyEntry(module, e, target);
    }
  }
  // Wildcard contributions are composed across the final node set, including late declarations.
  for (const module of modules.values())
    for (const e of module.entries) {
      if (e.target === 'node' || e.target === 'painted')
        for (const target of e.target === 'node' ? NODE_TYPES : PAINTED)
          applyEntry(module, e, target);
    }
}

function applyEntry(m: Module, e: ModuleEntry, target: string): void {
  const type = target as NodeType;
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
      (PAINT[target as 'fill' | 'stroke'] ?? OWN[target as NodeType])[k] = {
        ...v,
        feature: m.name,
      };
  const s = (
    target === 'fill'
      ? FILL
      : target === 'stroke'
        ? STROKE
        : target === 'timeline'
          ? TIMELINE
          : target === 'state'
            ? STATE
            : target === 'transition'
              ? TRANSITION
              : target === 'document'
                ? DOC
                : nodeShape(target as NodeType)
  ) as ObjShape;
  if (e.node) s.p.type = { ...s.p.type!, feature: m.name };
  for (const [k, v] of Object.entries(e.shapes)) s.p[k] = { ...v, feature: v.feature ?? m.name };
  Object.assign(ELEMENTS, e.elements);
  if (e.required) s.req = e.required;
}
