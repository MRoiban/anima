import type { Value, Model, InputM } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
export type PropertyType =
  'number' | 'string' | 'bool' | 'color' | 'trigger' | 'enum' | 'list' | 'model-ref' | 'asset-ref';
export interface Property {
  type: PropertyType;
  default?: unknown;
  value?: string;
  convert?: string;
  min?: number;
  max?: number;
  values?: string[];
  enum?: string;
  system?: string;
  of?: string;
  model?: string;
  assetType?: 'image' | 'font' | 'blob';
  public?: boolean;
  label?: string;
}
export interface Definition {
  properties: Record<string, Property>;
  global?: boolean;
}
export interface Instance {
  model: string;
  values?: Record<string, unknown>;
  default?: boolean;
  exported?: boolean;
  label?: string;
}
export interface DataDocument {
  models: Record<string, Definition>;
  instances?: Record<string, Instance>;
  enums?: Record<string, (string | { key: string; label?: string })[]>;
  model?: string;
  preview?: string;
}
export interface Binding {
  value: string;
  mode?: 'to-target' | 'to-source' | 'two-way' | 'once';
  prefer?: 'source' | 'target';
  convert?: string;
  options?: Record<string, unknown>;
}
export interface Context {
  player: Player;
  dt: number;
  direction: 'forward' | 'reverse';
  get(path: string): unknown;
  state: Map<unknown, unknown>;
  key?: string;
}
export type Converter = (value: unknown, options: Record<string, unknown>, ctx: Context) => unknown;
export interface Ref {
  instance: string;
  keys: string[];
  property: Property;
  readonly?: boolean;
  input: InputM;
}
export interface Compiled {
  document: DataDocument;
  defaults: Record<string, Record<string, unknown>>;
  defaultName: string;
  refs: Map<string, Ref>;
  model: Model;
  modelOf: WeakMap<object, string>;
}
export const compiled = new WeakMap<Model, Compiled>();
export const converters = new Map<string, Converter>();
export function registerConverter(name: string, run: Converter): void {
  converters.set(name, run);
}
export function scalarType(p: Property): InputM['type'] {
  return p.type === 'enum' || p.type === 'asset-ref'
    ? 'string'
    : p.type === 'list' || p.type === 'model-ref'
      ? 'number'
      : p.type;
}
export const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
export const asValue = (x: unknown): Value => x as Value;

export function clone<T>(v: T, seen = new Map<object, unknown>()): T {
  if (v === null || typeof v !== 'object') return v;
  if (seen.has(v)) return seen.get(v) as T;
  const out: Record<string, unknown> | unknown[] = Array.isArray(v) ? [] : {};
  seen.set(v, out);
  for (const [k, x] of Object.entries(v)) (out as Record<string, unknown>)[k] = clone(x, seen);
  return out as T;
}
