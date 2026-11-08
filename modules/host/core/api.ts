import { componentNames } from '../../components/core/names.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { DataState } from '../../data/core/storage.ts';
import type { DataDocument, Property } from '../../data/core/types.ts';
import type { ModuleRegistry } from '../../../packages/core/src/modules.ts';
import type { HostValues } from '../../host-values/core/index.ts';
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
export type PropertyHandle = {
  [K in keyof HandleValues]: DataHandle<HandleValues[K]> & { readonly type: K };
}[keyof HandleValues];
interface HandleValues {
  number: number;
  string: string;
  boolean: boolean;
  color: Color;
  enum: string;
  image: string;
  font: string;
  audio: string;
  blob: string;
  component: string;
  'text-style': string;
  list: unknown[];
  'model-ref': Record<string, unknown>;
  trigger: undefined;
}
export interface TriggerHandle extends DataHandle<undefined> {
  fire(): void;
}
export type Color = string | [number, number, number, number];
export interface ModelInfo {
  name: string;
  global?: boolean;
  properties: { name: string; type: string; values?: string[]; assetType?: string }[];
}
export interface RecordInstance extends DataInstance {
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
let scopeFor: (p: Player) => DataState | undefined;
export function observe(model: Model): void {
  if (observed.has(model) || !model.doc.data || !model.doc.requires?.includes('data')) return;
  observed.add(model);
  const document = model.doc.data as DataDocument;
  const globals = Object.entries(document.instances ?? {}).filter(
    ([, i]) => document.models[i.model]?.global,
  );
  if (globals.length) {
    const previous = model.resolveBindings;
    model.resolveBindings = (p, ...args) => {
      const scope = scopeFor(p);
      for (const [name] of globals) {
        const value = scope?.instances['@' + name];
        if (!value) continue;
        scope!.instances[name] = value;
        const record = apis.get(p)?.record(name);
        if (record) record.values = value;
      }
      previous?.(p, ...args);
    };
  }
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
export function install(
  shared: ModuleRegistry,
  state: (p: Player) => DataState | undefined,
  Values: typeof HostValues,
  children: (p: Player) => Player[],
): void {
  scopeFor = state;
  Object.defineProperty(shared.Player.prototype, 'data', {
    configurable: true,
    get(this: Player) {
      let api = apis.get(this);
      if (!api) {
        const scope = state(this);
        if (!scope) fail('model', '', 'this player has no data models');
        observe(this.model);
        apis.set(this, (api = new HostData(this, scope, shared, state, Values, children)));
      }
      return api;
    },
  });
}
export class HostData {
  /** Optional runtime resource catalog supplied by the host image editor. */
  declare resourceType?: (name: string) => string | undefined;
  #records = new Map<string, RecordInstance>();
  #bound?: RecordInstance;
  #owned = new WeakSet<DataInstance>();
  #projected = new Map<object, Map<string, unknown>>();
  #pending: (() => void)[] = [];
  #watches = new Set<Watch>();
  #depth = 0;
  #changed = false;
  #signals = new Map<string, number>();
  #targets = new Map<string, string[]>();
  #stepping = false;
  #values: HostValues;
  readonly player: Player;
  private scope: DataState;
  private children: (p: Player) => Player[];
  constructor(
    player: Player,
    scope: DataState,
    shared: ModuleRegistry,
    state: (p: Player) => DataState | undefined,
    Values: typeof HostValues,
    children: (p: Player) => Player[],
  ) {
    this.player = player;
    this.#values = new Values(player, scope, shared, state, this.#records, this.#owned);
    this.scope = scope;
    this.children = children;
    this.#signals = new Map(scope.signals);
    for (const [name, values] of Object.entries(scope.instances)) {
      const definition = scope.compiled.document.instances?.[name];
      if (!definition) continue;
      const model = definition.model;
      this.#records.set(name, { name, model, values });
    }
    for (const [name, record] of this.#records)
      this.#values.index(
        record.values,
        record.model,
        scope.compiled.document.instances![name]!.values,
      );
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
        this.#projected.clear();
        for (const write of pending) write();
        const result = step(...args);
        return this.#pending.length ? { ...result, settled: false } : result;
      } finally {
        this.#stepping = false;
      }
    };
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
        deliveries.push([watch, this.#values.copy(value)]);
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
        const name = property.of ?? this.#values.models.get(value as object);
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
    return this.#values.copy(this.#read(this.#address(path)));
  }
  /** Canonical identity for optional editors; retained aliases follow the current binding. */
  canonical(path: string): string {
    const a = this.#address(path.startsWith('$') ? path : '$' + path);
    return '$' + a.instance.name + ':' + a.keys.join('.');
  }
  /** Internal live projection shared with optional identity-preserving editors. */
  project(path: string, ...value: [] | [unknown]): unknown {
    const a = this.#address(path.startsWith('$') ? path : '$' + path);
    let object: Record<string, unknown> = this.#projection(
      this.scope.instances,
      a.instance.name,
    ) as Record<string, unknown>;
    for (const key of a.keys.slice(0, -1))
      object = this.#projection(object, key) as Record<string, unknown>;
    return this.#projection(object, a.keys.at(-1)!, ...value);
  }
  #projection(object: Record<string, unknown>, key: string, ...value: [] | [unknown]): unknown {
    let projected = this.#projected.get(object);
    if (value.length) {
      if (!projected) this.#projected.set(object, (projected = new Map()));
      projected.set(key, value[0]);
    }
    return projected?.has(key) ? projected.get(key) : object[key];
  }

  enqueue(write: () => void): void {
    if (typeof write !== 'function') fail('type', '', 'enqueue requires a write callback');
    this.#pending.push(write);
    this.wake();
  }
  wake(): void {
    this.#changed = true;
    if (!this.#depth) {
      this.#changed = false;
      this.player.onChange?.();
    }
  }
  #handle<T>(path: string, type: string): DataHandle<T> {
    path = path.startsWith('$') ? path : '$' + path;
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
    if (a.property.value !== undefined)
      throw new DataError(
        'read-only-path',
        '/data/' + path,
        'computed property is read-only',
        'write the source properties instead',
      );
    if (a.readonly) fail('readonly', path, 'list length is read-only');
    if (a.property.type === 'trigger') fail('type', path, 'triggers must be fired');
    const p = a.property;
    if (p.type === 'component' && typeof value === 'string' && value) {
      const names = componentNames(this.player.model.doc, value);
      if (names.length > 1)
        throw new DataError(
          'ambiguous-component',
          '/data/' + path,
          'ambiguous component name',
          'use ' + names.join(' or '),
        );
      value = names[0] ?? value;
    }
    if (!['list', 'model-ref'].includes(p.type) && !accepts(p, value))
      fail('type', path, 'value does not match property type');
    if (
      p.type === 'asset-ref' &&
      value !== '' &&
      (this.resourceType?.(String(value)) ??
        this.player.model.doc.assets?.[String(value)]?.type) !== p.assetType
    )
      fail('asset', path, 'asset reference kind does not match');
    let normalized: unknown;
    if (p.type === 'list' || p.type === 'model-ref')
      normalized = this.#values.validate({ properties: { value: p } }, { value }).value;
    else {
      normalized = copy(normalize(p, value));
    }
    this.#store(a, normalized, path, false);
    this.project(path, normalized);
    this.enqueue(() => this.#store(a, normalized, path, true));
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

  /** Resolve a nested path to its declared scalar handle. */
  at(path: string): PropertyHandle {
    path = path.startsWith('$') ? path : '$' + path;
    const p = this.#address(path).property;
    const type = p.type === 'bool' ? 'boolean' : p.type === 'asset-ref' ? p.assetType! : p.type;
    return Object.assign(this.#handle(path, type), { type }) as PropertyHandle;
  }
  exportedInstances(): DataInstance[] {
    return this.instances().filter(
      (i) => this.scope.compiled.document.instances?.[i.name]?.exported,
    );
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
  textStyle(path: string): DataHandle<string> {
    return this.#handle(path, 'text-style');
  }
  component(path: string): DataHandle<string> {
    return this.#handle(path, 'component');
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
        this.enqueue(() => {
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
    values = this.#values.values(definition.properties, values);
    const built = this.#values.validate(definition, values);
    let name = 'host' + this.#records.size;
    while (this.#records.has(name)) name += 'X';
    const record = { name, model, values: built };
    this.#records.set(name, record);
    this.#values.created[name] = { model, values: copy(values) };
    this.#values.index(built, model, values);
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
    this.wake();
  }
  record(name: string): RecordInstance | undefined {
    return this.#records.get(name);
  }
  rebindInstance(name: string, instance: DataInstance): void {
    const target = this.#records.get(name);
    const source = instance && this.#records.get(instance.name);
    if (!target || !source || !this.#owned.has(instance) || source.model !== instance.model)
      fail('instance', String(name), 'unknown instance or foreign instance record');
    if (target.model !== source.model) fail('type', name, 'replacement instance model must match');
    if (target === source) return;
    const projected = this.#projection(this.scope.instances, source.name);
    for (const [key, value] of Object.entries(this.scope.instances))
      if (value === target.values) this.#projection(this.scope.instances, key, projected);
    this.enqueue(() => {
      const old = target.values,
        value = source.values;
      const visit = (player: Player) => {
        const scope = this.#values.state(player);
        if (scope) {
          this.#values.share(value, scope);
          for (const [key, item] of Object.entries(scope.instances)) {
            if (
              item !== old &&
              !(
                key === name &&
                this.scope.compiled.document.models[target.model]?.global &&
                scope.compiled.document.instances?.[key]?.model === target.model
              )
            )
              continue;
            scope.instances[key] = value;
            const record = apis.get(player)?.record(key);
            if (record) record.values = value;
          }
        }
        for (const child of this.children(player)) visit(child);
      };
      visit(this.player);
    });
  }
  models(): ModelInfo[] {
    return Object.entries(this.scope.compiled.document.models)
      .filter(([name]) => name !== '$comment')
      .map(([name, def]) => ({
        name,
        ...(def.global ? { global: true } : {}),
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
