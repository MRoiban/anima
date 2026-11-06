import { clone } from './types.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { Value } from '../../../packages/core/src/load.ts';
import { parseHex, formatHex } from '../../../packages/core/src/color.ts';
import { compiled, scalarType, type Compiled, type Property, type Ref } from './types.ts';
const states = new WeakMap<Player, DataState>();
export function accepts(p: Property, value: unknown): boolean {
  if (p.type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (p.type === 'bool') return typeof value === 'boolean';
  if (p.type === 'color')
    return typeof value === 'string'
      ? !!parseHex(value)
      : Array.isArray(value) &&
          value.length === 4 &&
          value.every((v) => typeof v === 'number' && v >= 0 && v <= 255);
  if (p.type === 'enum') return typeof value === 'string' && !!p.values?.includes(value);
  if (p.type === 'string' || p.type === 'asset-ref') return typeof value === 'string';
  return false;
}
export function normalize(p: Property, value: unknown): Value {
  if (p.type === 'number')
    return Math.max(p.min ?? -Infinity, Math.min(p.max ?? Infinity, Number(value)));
  if (p.type === 'color' && typeof value === 'string') return parseHex(value)!;
  return value as Value;
}
export class DataState extends Map<string, Value> {
  instances: Record<string, Record<string, unknown>>;
  modelTypes?: WeakMap<object, string>;
  readonly compiled: Compiled;
  readonly signals = new Map<string, number>();
  readonly converterState = new Map<unknown, unknown>();
  player?: Player;
  initial?: ReadonlyMap<string, Value>;
  constructor(c: Compiled) {
    super();
    this.compiled = c;
    const seen = new Map<object, unknown>();
    this.instances = clone(c.defaults, seen);
    this.modelTypes = new WeakMap();
    for (const [source, value] of seen) {
      const name = c.modelOf.get(source);
      if (name) this.modelTypes.set(value as object, name);
    }
  }
  /** Authored export discovery; private instances remain available to internal bindings. */
  exports(): { name: string; model: string }[] {
    return Object.entries(this.compiled.document.instances ?? {})
      .filter(([, instance]) => instance.exported)
      .map(([name, instance]) => ({ name, model: instance.model }));
  }
  ref(path: string): Ref | undefined {
    return this.compiled.refs.get(path);
  }
  override get(path: string): Value | undefined {
    const r = this.ref(path);
    if (!r) return super.get(path);
    let value: unknown = this.instances[r.instance];
    for (const key of r.keys)
      value = value == null ? undefined : (value as Record<string, unknown>)[key];
    return value as Value;
  }
  override set(path: string, value: Value): this {
    const r = this.ref(path);
    if (!r) return super.set(path, value);
    // Player initializes the complete scope; defaults already live in detached instances.
    if (r.readonly) return this;
    if (!accepts(r.property, value)) throw new Error('anima: data-type ' + path);
    let object: Record<string, unknown> = this.instances[r.instance]!;
    for (const key of r.keys.slice(0, -1)) object = object[key] as Record<string, unknown>;
    object[r.keys.at(-1)!] = normalize(r.property, value);
    return this;
  }
  read(path: string): unknown {
    if (this.ref(path)) return this.get(path);
    const match = /^\$(?:([\w-]+):)?([\w.-]+)$/.exec(path);
    if (!match) return undefined;
    let v: unknown = this.instances[match[1] ?? this.compiled.defaultName];
    for (const k of match[2]!.split('.'))
      v = v == null ? undefined : (v as Record<string, unknown>)[k];
    return v;
  }
}
export function dataState(player: Player): DataState | undefined {
  return states.get(player);
}
export function createScope(player: Player): DataState {
  const s = new DataState(compiled.get(player.model)!);
  s.player = player;
  states.set(player, s);
  return s;
}
export function inputFor(
  property: Property,
  value: unknown,
  name: string,
  readonly = false,
): Ref['input'] {
  return {
    name,
    type: scalarType(property),
    def: normalize(property, value),
    min: property.min ?? -Infinity,
    max: property.max ?? Infinity,
    buffer: 0,
    readonly,
    accepts: (value) => accepts(property, value),
  };
}
export const printable = (v: Value): number | string | boolean =>
  Array.isArray(v) ? formatHex(v) : v;
