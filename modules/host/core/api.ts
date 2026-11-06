import type { Model } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { DataState } from '../../data/core/storage.ts';
import type { Property } from '../../data/core/types.ts';
import type { ModuleRegistry } from '../../../packages/core/src/modules.ts';
import { accepts, normalize } from '../../data/core/storage.ts';
import { codes, DataError, fail } from './errors.ts';
export { DataError } from './errors.ts';
export interface DataInstance {
  readonly name: string;
  readonly model: string;
}
export interface DataHandle<T> {
  readonly value: T;
  set(value: T): void;
  on(event: 'change', callback: (value: T) => void): () => void;
}
export interface TriggerHandle extends DataHandle<undefined> {
  fire(): void;
}
export type Color = string | [number, number, number, number];
export interface ModelInfo {
  name: string;
  properties: { name: string; type: string; values?: string[]; assetType?: string }[];
}
interface RecordInstance extends DataInstance {
  values: Record<string, unknown>;
}
interface Address {
  instance: RecordInstance;
  keys: string[];
  property: Property;
  readonly?: boolean;
}
interface Watch {
  path: string;
  callback: (value: never) => void;
  last: string | undefined;
  source?: string;
}
import { clone as copy } from '../../data/core/types.ts';
const apis = new WeakMap<Player, HostData>();
const observed = new WeakSet<Model>();
export function observe(model: Model): void {
  if (observed.has(model) || !model.doc.data || !model.doc.requires?.includes('data')) return;
  observed.add(model);
  const previousSignal = model.signal;
  model.signal = (player, name) => {
    previousSignal?.(player, name);
    apis.get(player)?.signal(name);
  };
  const previous = model.afterStep;
  model.afterStep = (player) => {
    previous?.(player);
    apis.get(player)?.notify();
  };
}
export function install(shared: ModuleRegistry, state: (p: Player) => DataState | undefined): void {
  Object.defineProperty(shared.Player.prototype, 'data', {
    configurable: true,
    get(this: Player) {
      let api = apis.get(this);
      if (!api) {
        const scope = state(this);
        if (!scope) fail('model', '', 'this player has no data models');
        observe(this.model);
        apis.set(this, (api = new HostData(this, scope, shared, state)));
      }
      return api;
    },
  });
}
export class HostData {
  #records = new Map<string, RecordInstance>();
  #bound?: RecordInstance;
  #owned = new WeakSet<DataInstance>();
  #pending: (() => void)[] = [];
  #watches = new Set<Watch>();
  #depth = 0;
  #changed = false;
  #signals = new Map<string, number>();
  #targets = new Map<string, string[]>();
  #stepping = false;
  #models = new WeakMap<object, string>();
  #created: Record<string, { model: string; values: Record<string, unknown> }> = {};
  readonly player: Player;
  private scope: DataState;
  private shared: ModuleRegistry;
  private state: (p: Player) => DataState | undefined;
  constructor(
    player: Player,
    scope: DataState,
    shared: ModuleRegistry,
    state: (p: Player) => DataState | undefined,
  ) {
    this.player = player;
    this.scope = scope;
    this.shared = shared;
    this.state = state;
    this.#signals = new Map(scope.signals);
    for (const [name, values] of Object.entries(scope.instances)) {
      const model = scope.compiled.document.instances![name]!.model;
      this.#records.set(name, { name, model, values });
    }
    for (const [name, record] of this.#records)
      this.#index(record.values, record.model, scope.compiled.document.instances![name]!.values);
    const busy = Object.getOwnPropertyDescriptor(shared.Player.prototype, 'busy')!.get!;
    Object.defineProperty(player, 'busy', {
      configurable: true,
      get: () => this.#pending.length > 0 || busy.call(player),
    });
    const ref = scope.ref.bind(scope),
      read = scope.read.bind(scope);
    // Only default aliases are rebound; named paths keep their identity. The shared compiled
    // refs/model are never mutated, so players made from the same model remain independent.
    scope.ref = (path) => {
      const r = ref(path);
      if (!this.#bound || path.includes(':') || !path.startsWith('$') || !r) return r;
      return { ...r, instance: this.#bound.name };
    };
    scope.read = (path) => {
      if (this.#bound && path.startsWith('$') && !path.includes(':')) {
        let v: unknown = this.#bound.values;
        for (const k of path.slice(1).split('.')) v = (v as Record<string, unknown>)?.[k];
        return v;
      }
      return read(path);
    };
    const step = player.step.bind(player);
    player.step = (...args) => {
      if (this.#depth || this.#stepping)
        fail('type', '', 'step inside data.batch or subscription is not allowed');
      if (!(args[0] >= 0)) return step(...args);
      this.#stepping = true;
      try {
        const pending = this.#pending;
        this.#pending = [];
        for (const write of pending) write();
        const result = step(...args);
        return this.#pending.length ? { ...result, settled: false } : result;
      } finally {
        this.#stepping = false;
      }
    };
  }
  #index(values: Record<string, unknown>, model: string, raw: Record<string, unknown> = {}): void {
    if (this.#models.has(values)) return;
    this.#models.set(values, model);
    this.#children(this.scope.compiled.document.models[model]!.properties, values, raw);
  }
  #children(
    properties: Record<string, Property>,
    values: Record<string, unknown>,
    raw: Record<string, unknown>,
  ): void {
    for (const [key, p] of Object.entries(properties)) {
      if (key === '$comment') continue;
      const source = raw[key] ?? p.default;
      const item = (v: unknown, input: unknown, fixed?: string) => {
        const r = input as
          { model?: string; values?: Record<string, unknown>; instance?: string } | undefined;
        const named = typeof input === 'string' ? input : r?.instance;
        const instance = named
          ? (this.scope.compiled.document.instances?.[named] ?? this.#created[named])
          : undefined;
        const type = fixed ?? instance?.model ?? r?.model;
        if (v && typeof v === 'object' && type)
          this.#index(
            v as Record<string, unknown>,
            type,
            instance?.values ?? r?.values ?? (input as Record<string, unknown>),
          );
      };
      if (p.type === 'model-ref') item(values[key], source, p.model);
      if (p.type === 'list')
        (values[key] as unknown[]).forEach((v, i) =>
          item(v, (source as unknown[] | undefined)?.[i], p.of),
        );
    }
  }
  signal(name: string): void {
    const prefix = '$' + this.scope.compiled.defaultName + ':';
    const target =
      this.#targets.get(name)?.shift() ??
      (this.#bound && name.startsWith(prefix)
        ? '$' + this.#bound.name + ':' + name.slice(prefix.length)
        : name);
    this.#signals.set(target, (this.#signals.get(target) ?? 0) + 1);
  }

  /** Called only by the chained model.afterStep hook. */
  notify(): void {
    const deliveries: [Watch, unknown][] = [];
    for (const watch of this.#watches) {
      let a: Address;
      try {
        a = this.#address(watch.path);
      } catch (error) {
        if (error instanceof DataError && error.code === codes.path) {
          this.#watches.delete(watch);
          continue;
        }
        throw error;
      }
      const value = this.#read(a);
      const stamp = this.#stamp(a, value);
      const source =
        a.property.type === 'trigger' ? a.instance.name + ':' + a.keys.join('.') : undefined;
      if (stamp !== watch.last && source === watch.source)
        deliveries.push([watch, this.#copy(value)]);
      watch.last = stamp;
      watch.source = source;
    }
    for (const [watch, value] of deliveries)
      if (this.#watches.has(watch)) watch.callback(value as never);
  }
  #address(path: string): Address {
    if (typeof path !== 'string') fail('type', String(path), 'data paths must be strings');
    const m = /^\$(?:([A-Za-z][\w-]*):)?([A-Za-z][\w-]*(?:\.[\w-]+)*)$/.exec(path);
    if (!m) fail('path', path, 'expected a $property or $instance:property path');
    const instance = m[1] ? this.#records.get(m[1]) : this.#bound;
    if (!instance) fail('instance', path, 'unknown instance or no instance is bound');
    const keys = m[2]!.split('.');
    let properties = this.scope.compiled.document.models[instance.model]!.properties;
    let value: unknown = instance.values;
    let property: Property | undefined;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]!;
      property = Object.hasOwn(properties, k) ? properties[k] : undefined;
      if (!property) fail('path', path, 'unknown data property');
      value = (value as Record<string, unknown>)?.[k];
      if (i === keys.length - 1) break;
      if (property.type === 'list') {
        const index = keys[++i]!;
        if (index === 'length' && i === keys.length - 1)
          return { instance, keys, property: { type: 'number' }, readonly: true };
        if (!/^(0|[1-9]\d*)$/.test(index) || !Array.isArray(value) || +index >= value.length)
          fail('path', path, 'unknown list index');
        value = value[+index];
        const name = property.of ?? this.#models.get(value as object);
        if (!name) fail('model', path, 'list item has no discoverable model');
        if (i === keys.length - 1)
          return { instance, keys, property: { type: 'model-ref', model: name } };
        properties = this.scope.compiled.document.models[name]!.properties;
      } else if (property.type === 'model-ref')
        properties = this.scope.compiled.document.models[property.model!]!.properties;
      else fail('path', path, 'path continues through a scalar');
    }
    return { instance, keys, property: property! };
  }
  #read(a: Address): unknown {
    let value: unknown = a.instance.values;
    for (const key of a.keys) value = (value as Record<string, unknown>)?.[key];
    return value;
  }
  #stamp(a: Address, value: unknown): string | undefined {
    if (a.property.type === 'trigger') {
      const path = '$' + a.instance.name + ':' + a.keys.join('.');
      return String(this.#signals.get(path) ?? 0);
    }
    return JSON.stringify(value);
  }
  get(path: string): unknown {
    return this.#copy(this.#read(this.#address(path)));
  }
  #copy(input: unknown): unknown {
    const seen = new Map<object, unknown>();
    const value = copy(input, seen);
    for (const [source, cloned] of seen) {
      const model = this.#models.get(source);
      if (model) this.#models.set(cloned as object, model);
    }
    return value;
  }
  #values(
    properties: Record<string, Property>,
    values: Record<string, unknown>,
    seen = new Map<object, Record<string, unknown>>(),
    depth = 0,
  ): Record<string, unknown> {
    if (!values || typeof values !== 'object' || Array.isArray(values))
      fail('type', '', 'instance values must be property maps');
    if (depth >= 32) return values;
    if (seen.has(values)) return seen.get(values)!;
    const out = { ...values };
    seen.set(values, out);
    const item = (value: unknown, fixed?: string): unknown => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      if (this.#owned.has(value as DataInstance)) return { instance: (value as DataInstance).name };
      const raw = value as { model?: string; values?: Record<string, unknown>; instance?: string };
      if (raw.instance) return value;
      const known = this.#models.get(value);
      const model = known ?? raw.model ?? fixed;
      const def = model && this.scope.compiled.document.models[model];
      return def
        ? {
            model,
            values: this.#values(
              def.properties,
              known
                ? (value as Record<string, unknown>)
                : (raw.values ?? (value as Record<string, unknown>)),
              seen,
              depth + 1,
            ),
          }
        : value;
    };
    for (const [key, value] of Object.entries(values)) {
      const p = properties[key];
      out[key] =
        p?.type === 'list' && Array.isArray(value)
          ? value.map((v) => item(v, p.of))
          : p?.type === 'model-ref'
            ? item(value, p.model)
            : value;
    }
    return out;
  }

  #enqueue(write: () => void): void {
    this.#pending.push(write);
    this.#changed = true;
    if (!this.#depth) {
      this.#changed = false;
      this.player.onChange?.();
    }
  }
  #handle<T>(path: string, type: string): DataHandle<T> {
    const a = this.#address(path);
    const actual =
      a.property.type === 'bool'
        ? 'boolean'
        : a.property.type === 'asset-ref'
          ? a.property.assetType
          : a.property.type;
    if (type !== actual) fail('type', path, 'requested handle does not match property type');
    // Handles resolve their path again: a retained default handle follows bind().
    const read = () => this.get(path) as T;
    return {
      get value() {
        return read();
      },
      set: (value) => this.#set(path, value),
      on: (event, callback) => {
        if (event !== 'change' || typeof callback !== 'function')
          fail('type', path, 'change subscriptions require a callback');
        const a = this.#address(path);
        const watch: Watch = {
          path,
          callback: callback as Watch['callback'],
          last: this.#stamp(a, this.#read(a)),
          source:
            a.property.type === 'trigger' ? a.instance.name + ':' + a.keys.join('.') : undefined,
        };
        this.#watches.add(watch);
        return () => {
          this.#watches.delete(watch);
        };
      },
    };
  }
  #set(path: string, value: unknown): void {
    const a = this.#address(path);
    if (a.readonly) fail('readonly', path, 'list length is read-only');
    if (a.property.type === 'trigger') fail('type', path, 'triggers must be fired');
    const p = a.property;
    if (!['list', 'model-ref'].includes(p.type) && !accepts(p, value))
      fail('type', path, 'value does not match property type');
    if (
      p.type === 'asset-ref' &&
      value !== '' &&
      this.player.model.doc.assets?.[String(value)]?.type !== p.assetType
    )
      fail('asset', path, 'asset reference kind does not match');
    let normalized: unknown;
    if (p.type === 'list' || p.type === 'model-ref')
      normalized = this.#validate({ properties: { value: p } }, { value }).value;
    else {
      normalized = copy(normalize(p, value));
    }
    this.#store(a, normalized, path, false);
    this.#enqueue(() => this.#store(a, normalized, path, true));
  }
  #store(a: Address, value: unknown, path: string, apply: boolean): void {
    let object = a.instance.values;
    for (const k of a.keys.slice(0, -1)) {
      const next = object[k];
      if (!next || typeof next !== 'object') fail('path', path, 'queued path no longer exists');
      object = next as Record<string, unknown>;
    }
    const seen = new Set<object>(),
      pending: unknown[] = [value];
    while (pending.length) {
      const item = pending.pop();
      if (!item || typeof item !== 'object' || seen.has(item)) continue;
      if (item === object)
        fail('cycle', path, 'data writes must preserve an acyclic instance graph');
      seen.add(item);
      pending.push(...Object.values(item));
    }
    if (apply) object[a.keys.at(-1)!] = value;
  }

  #validate(
    def: { properties: Record<string, Property> },
    values: Record<string, unknown>,
  ): Record<string, unknown> {
    values = this.#values(def.properties, values);
    const document = this.scope.compiled.document;
    let instanceName = 'hostValue';
    while (this.#records.has(instanceName)) instanceName += 'X';
    let name = 'HostValue';
    while (Object.hasOwn(document.models, name)) name += 'X';
    const result = this.shared.load({
      anima: '0.1',
      name: 'host-value',
      grid: 20,
      nodes: [{ id: 'host', type: 'group', children: [] }],
      requires: this.player.model.doc.requires,
      ...(this.player.model.doc.assets ? { assets: this.player.model.doc.assets } : {}),
      data: {
        ...document,
        model: name,
        models: { ...document.models, [name]: def },
        instances: {
          ...Object.fromEntries(
            Object.entries({ ...document.instances, ...this.#created }).map(([k, v]) => [
              k,
              { ...v, default: false },
            ]),
          ),
          [instanceName]: { model: name, values, default: true },
        },
      },
    });
    const error = result.diagnostics.find((d) => d.severity === 'error');
    if (error) throw DataError.from(error);
    const scope = this.state(new this.shared.Player(result.model!))!;
    const replacements = new Map(
      Object.entries(scope.instances)
        .filter(([k]) => this.#records.has(k))
        .map(([k, v]) => [v, this.#records.get(k)!.values]),
    );
    const seen = new Map<object, unknown>(replacements);
    const clone = (v: unknown): unknown => {
      if (!v || typeof v !== 'object') return v;
      if (seen.has(v)) return seen.get(v);
      const out: Record<string, unknown> | unknown[] = Array.isArray(v) ? [] : {};
      seen.set(v, out);
      for (const [k, x] of Object.entries(v)) (out as Record<string, unknown>)[k] = clone(x);
      return out;
    };
    const built = clone(scope.instances[instanceName]) as Record<string, unknown>;
    this.#children(def.properties, built, values);
    return built;
  }
  number(path: string): DataHandle<number> {
    return this.#handle(path, 'number');
  }
  string(path: string): DataHandle<string> {
    return this.#handle(path, 'string');
  }
  boolean(path: string): DataHandle<boolean> {
    return this.#handle(path, 'boolean');
  }
  color(path: string): DataHandle<Color> {
    return this.#handle(path, 'color');
  }
  enum(path: string): DataHandle<string> {
    return this.#handle(path, 'enum');
  }
  list(path: string): DataHandle<unknown[]> {
    return this.#handle(path, 'list');
  }
  image(path: string): DataHandle<string> {
    return this.#handle(path, 'image');
  }
  font(path: string): DataHandle<string> {
    return this.#handle(path, 'font');
  }
  trigger(path: string): TriggerHandle {
    const handle = this.#handle<undefined>(path, 'trigger');
    return Object.assign(handle, {
      fire: () => {
        const a = this.#address(path),
          key = '$' + a.instance.name + ':' + a.keys.join('.');
        const canonical =
          (this.#bound === a.instance
            ? this.scope.compiled.refs.get('$' + a.keys.join('.'))?.input.name
            : undefined) ?? this.scope.ref(key)?.input.name;
        this.#enqueue(() => {
          if (canonical && this.player.model.inputs.has(canonical)) {
            let targets = this.#targets.get(canonical);
            if (!targets) this.#targets.set(canonical, (targets = []));
            targets.push(key);
            this.player.fire(canonical);
          } else this.#signals.set(key, (this.#signals.get(key) ?? 0) + 1);
        });
      },
    });
  }
  instances(): DataInstance[] {
    return [...this.#records.values()].map((record) => this.#public(record));
  }
  create(model: string, values: Record<string, unknown> = {}): DataInstance {
    const defs = this.scope.compiled.document.models;
    const definition = Object.hasOwn(defs, model) ? defs[model] : undefined;
    if (!definition) fail('model', model, 'unknown data model');
    values = this.#values(definition.properties, values);
    const built = this.#validate(definition, values);
    let name = 'host' + this.#records.size;
    while (this.#records.has(name)) name += 'X';
    const record = { name, model, values: built };
    this.#records.set(name, record);
    this.#created[name] = { model, values: copy(values) };
    this.#index(built, model, values);
    this.scope.instances[name] = built;
    return this.#public(record);
  }
  #public({ name, model }: DataInstance): DataInstance {
    const handle = { name, model };
    this.#owned.add(handle);
    return handle;
  }
  bind(instance: DataInstance | string): void {
    if (!instance || !['string', 'object'].includes(typeof instance))
      fail('instance', String(instance), 'unknown data instance');
    const record = this.#records.get(typeof instance === 'string' ? instance : instance.name);
    if (
      !record ||
      (typeof instance !== 'string' &&
        (!this.#owned.has(instance) || instance.model !== record.model))
    )
      fail('instance', String(instance), 'unknown data instance');
    const defaultModel =
      this.scope.compiled.document.instances![this.scope.compiled.defaultName]!.model;
    if (record.model !== defaultModel)
      fail('type', record.name, 'bound instance must have the default model');
    this.#bound = record;
    for (const watch of this.#watches) {
      if (watch.path.includes(':')) continue;
      let a: Address;
      try {
        a = this.#address(watch.path);
      } catch (error) {
        if (error instanceof DataError && error.code === codes.path) {
          this.#watches.delete(watch);
          continue;
        }
        throw error;
      }
      if (a.property.type === 'trigger') {
        watch.last = this.#stamp(a, undefined);
        watch.source = a.instance.name + ':' + a.keys.join('.');
      }
    }
    this.player.onChange?.();
  }
  models(): ModelInfo[] {
    return Object.entries(this.scope.compiled.document.models)
      .filter(([name]) => name !== '$comment')
      .map(([name, def]) => ({
        name,
        properties: Object.entries(def.properties)
          .filter(([key]) => key !== '$comment')
          .map(([name, p]) => ({
            name,
            type: p.type,
            ...(p.values ? { values: [...p.values] } : {}),
            ...(p.assetType ? { assetType: p.assetType } : {}),
          })),
      }));
  }
  batch<T>(fn: () => T): T {
    if (typeof fn !== 'function') fail('type', '', 'batch requires a callback');
    this.#depth++;
    try {
      return fn();
    } finally {
      if (!--this.#depth && this.#changed) {
        this.#changed = false;
        this.player.onChange?.();
      }
    }
  }
}
declare module '../../../packages/core/src/player.ts' {
  interface Player {
    readonly data: HostData;
  }
}
