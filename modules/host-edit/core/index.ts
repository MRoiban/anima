import type { Module, ModuleRegistry } from '../../../packages/core/src/modules.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { ComponentModule } from '../../components/core/index.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { formatHex, type RGBA } from '../../../packages/core/src/color.ts';
import type { DataModule } from '../../data/core/index.ts';
import type { DataState } from '../../data/core/storage.ts';
import type { Property } from '../../data/core/types.ts';
import type { HostData, DataHandle, DataInstance, Color } from '../../host/core/api.ts';
import { fail } from '../../host/core/errors.ts';
import { after } from '../manifest.ts';

export interface ColorHandle extends DataHandle<Color> {
  readonly rgba: RGBA;
  readonly hex: string;
}
export interface EnumHandle extends DataHandle<string> {
  readonly values: string[];
  index: number;
}
export interface ItemHandle {
  get(path: string): unknown;
  number(path: string): DataHandle<number>;
  string(path: string): DataHandle<string>;
  boolean(path: string): DataHandle<boolean>;
  color(path: string): ColorHandle;
  enum(path: string): EnumHandle;
  component(path: string): DataHandle<string>;
  list(path: string): ListHandle;
}
export interface ListHandle extends DataHandle<unknown[]> {
  readonly length: number;
  at(index: number): ItemHandle;
  add(values?: Record<string, unknown> | DataInstance): void;
  insert(index: number, values?: Record<string, unknown> | DataInstance): void;
  remove(item: number | ItemHandle | DataInstance): void;
  swap(a: number, b: number): void;
}
export type ImageHandle = DataHandle<string> & {
  set(value: string | object): void | Promise<void>;
};
export type ImageReplacement = (api: HostData, path: string, value: unknown) => Promise<void>;
const extended = new WeakSet<HostData>();
export function queueEdit(api: HostData, write: () => void): void {
  api.enqueue(write);
}
const items = new WeakMap<object, object>();

/** Resolve via the active data module, never a separately bundled copy of its WeakMap. */
function extend(api: HostData, state: DataState): void {
  if (extended.has(api)) return;
  extended.add(api);
  const player = api.player;
  api.resourceType = (name) => hostEdit.resourceType?.(player, name);
  const canonical = (path: string) => (path.startsWith('$') ? path : '$' + path);
  const types = (state.modelTypes ??= new WeakMap<object, string>());
  const indexTypes = (raw: unknown, live: unknown) => {
    if (!raw || !live || typeof raw !== 'object' || typeof live !== 'object') return;
    const model = state.compiled.modelOf.get(raw);
    if (model) types.set(live, model);
    for (const key of Object.keys(raw))
      indexTypes((raw as Record<string, unknown>)[key], (live as Record<string, unknown>)[key]);
  };
  indexTypes(state.compiled.defaults, state.instances);
  let bound = state.compiled.defaultName;
  const bind = api.bind.bind(api);
  // Host may have been bound before this optional bundle arrived. Its public ref adapter
  // reports the currently bound instance without mutating the compiled default metadata.
  const probe = [...state.compiled.refs.keys()].find((key) => !key.includes(':'));
  if (probe) bound = state.ref(probe)?.instance ?? bound;
  api.bind = (instance) => {
    bind(instance);
    bound = typeof instance === 'string' ? instance : instance.name;
  };
  const address = (path: string) => {
    path = canonical(path);
    // Host performs the public path/unbound/type validation.
    api.get(path);
    const match = /^\$(?:([\w-]+):)?([\w.-]+)$/.exec(path)!;
    const name = match[1] ?? bound;
    const record = api.instances().find((i) => i.name === name)!;
    let properties = state.compiled.document.models[record.model]!.properties;
    let value: unknown = state.instances[name];
    let property: Property | undefined;
    const keys = match[2]!.split('.');
    for (let i = 0; i < keys.length; i++) {
      property = properties[keys[i]!]!;
      value = (value as Record<string, unknown>)[keys[i]!];
      if (i === keys.length - 1) break;
      if (property.type === 'list') {
        value = (value as unknown[])[+keys[++i]!];
        const model =
          property.of ?? state.modelTypes?.get(value as object) ?? types.get(value as object);
        if (!model) fail('model', path, 'list item has no discoverable model');
        properties = state.compiled.document.models[model]!.properties;
      } else properties = state.compiled.document.models[property.model!]!.properties;
    }
    return { property: property!, value, path: '$' + name + ':' + match[2] };
  };
  const projected = new Map<object[], object[]>();
  const enqueue = (write: () => void) =>
    api.enqueue(() => {
      projected.clear();
      write();
    });
  const color = api.color.bind(api);
  api.color = (path): ColorHandle =>
    Object.defineProperties(color(path), {
      rgba: { get: () => color(path).value },
      hex: { get: () => formatHex(color(path).value as RGBA) },
    }) as ColorHandle;
  const enumeration = api.enum.bind(api);
  api.enum = (path): EnumHandle => {
    const handle = enumeration(path);
    const values = () => [...address(path).property.values!];
    return Object.defineProperties(handle, {
      values: { get: values },
      index: {
        get: () => values().indexOf(handle.value),
        set: (i: number) => {
          if (!Number.isInteger(i) || i < 0 || i >= values().length)
            fail('enum', path, 'enum index is out of range');
          handle.set(values()[i]!);
        },
      },
    }) as EnumHandle;
  };
  api.defaultInstance = () => api.instance(state.compiled.defaultName);
  api.instance = (name) => {
    const instance = api.instances().find((i) => i.name === name);
    if (!instance) fail('instance', String(name), 'unknown data instance');
    return instance;
  };
  api.globals = () =>
    api
      .instances()
      .filter(
        (i) =>
          state.compiled.document.instances?.[i.name] &&
          state.compiled.document.models[i.model]?.global,
      );
  api.setGlobal = (name, instance) => {
    if (!api.globals().some((i) => i.name === name))
      fail('instance', String(name), 'unknown global instance');
    api.rebindInstance(name, instance);
  };
  const image = api.image.bind(api);
  api.image = (path): ImageHandle => {
    const handle = image(path);
    const set = handle.set;
    handle.set = (value: string | object) => {
      if (typeof value !== 'string' && (!value || typeof value !== 'object'))
        fail('type', path, 'image replacement must be an asset name, URL or Blob');
      if (
        typeof value === 'string' &&
        (value === '' || player.model.doc.assets?.[value] || api.resourceType?.(value) === 'image')
      )
        return set(value);
      if (!hostEdit.replaceImage)
        fail('asset', path, 'image replacement requires the web host-edit entry');
      return hostEdit.replaceImage(api, path, value);
    };
    return handle;
  };
  const list = api.list.bind(api);
  api.list = (path): ListHandle => {
    const handle = list(path);
    const current = () => address(path).value as object[];
    const projection = () => api.project(path) as object[];
    const commit = (values: object[]) => {
      const a = address(path);
      projected.set(a.value as object[], values);
      api.project(a.path, values);
      enqueue(() => {
        const target = address(a.path).value as object[];
        target.splice(0, target.length, ...values);
      });
    };
    const check = (i: number, length: number) => {
      if (!Number.isInteger(i) || i < 0 || i >= length)
        fail('path', path, 'list index is out of range');
    };
    const at = (i: number): ItemHandle => {
      const values = current();
      check(i, values.length);
      const item = values[i]!;
      const target = (key: string) => {
        const index = current().indexOf(item);
        if (index < 0) fail('path', path, 'list item has been removed');
        return canonical(path) + '.' + index + '.' + key.replace(/^\$/, '');
      };
      const nested: ItemHandle = {
        get: (key) => api.get(target(key)),
        number: (key) => api.number(target(key)),
        string: (key) => api.string(target(key)),
        boolean: (key) => api.boolean(target(key)),
        color: (key) => api.color(target(key)),
        enum: (key) => api.enum(target(key)),
        component: (key) => api.component(target(key)),
        list: (key) => api.list(target(key)),
      };
      items.set(nested, item);
      return nested;
    };
    const insert = (i: number, values: Record<string, unknown> | DataInstance = {}) => {
      if (!values || typeof values !== 'object' || Array.isArray(values))
        fail('type', path, 'list values must be a property map or instance record');
      const a = address(path);
      const value = a.value as object[];
      const next = [...projection()];
      // Bounds follow queued edits without exposing their pending values.
      check(i, next.length + 1);
      let instance: DataInstance;
      if ('name' in values && 'model' in values) {
        instance = api.instance(String(values.name));
        if (instance.model !== values.model)
          fail('instance', path, 'instance model does not match');
      } else {
        if (!a.property.of) fail('model', path, 'mixed lists require an explicit instance');
        instance = api.create(a.property.of, values);
      }
      if (a.property.of && instance.model !== a.property.of)
        fail('type', path, 'list item model does not match');
      const item = state.instances[instance.name]!;
      types.set(item, instance.model);
      const seen = new Set<object>();
      const cycle = (v: unknown): boolean => {
        if (!v || typeof v !== 'object' || seen.has(v)) return false;
        if (v === value) return true;
        seen.add(v);
        return Object.values(Array.isArray(v) ? (projected.get(v) ?? v) : v).some(cycle);
      };
      if (cycle(item)) fail('cycle', path, 'list mutation would create a data cycle');
      next.splice(i, 0, item);
      commit(next);
    };
    return Object.defineProperty(
      Object.assign(handle, {
        at,
        insert,
        add: (values?: Record<string, unknown> | DataInstance) =>
          insert(projection().length, values),
        remove: (item: number | ItemHandle | DataInstance) => {
          if (typeof item !== 'number' && (!item || typeof item !== 'object'))
            fail('type', path, 'remove requires an index or item');
          const values = [...projection()];
          const index =
            typeof item === 'number'
              ? item
              : values.indexOf(items.get(item) ?? state.instances[(item as DataInstance).name]!);
          check(index, values.length);
          values.splice(index, 1);
          commit(values);
        },
        swap: (a: number, b: number) => {
          const next = [...projection()];
          check(a, next.length);
          check(b, next.length);
          [next[a], next[b]] = [next[b]!, next[a]!];
          commit(next);
        },
      }),
      'length',
      { get: () => current().length },
    ) as ListHandle;
  };
}

declare module '../../host/core/api.ts' {
  interface HostData {
    color(path: string): ColorHandle;
    enum(path: string): EnumHandle;
    list(path: string): ListHandle;
    image(path: string): ImageHandle;
    defaultInstance(): DataInstance;
    instance(name: string): DataInstance;
    globals(): DataInstance[];
    setGlobal(name: string, instance: DataInstance): void;
  }
}
const roots = new WeakMap<Model, Map<string, Model>>();
let compiling: Map<string, Model> | undefined;
export const hostEdit: Module & {
  roots: typeof roots;
  resourceType?: (player: Player, name: string) => string | undefined;
  replaceImage?: ImageReplacement;
  compile?: ModuleRegistry['load'];
} = {
  roots,
  name: 'hostedit',
  after,
  entries: [],
  init(registry, shared: ModuleRegistry) {
    hostEdit.compile = shared.load;
    const components = registry.get('components') as ComponentModule | undefined;
    if (components) {
      const fork = components.forkModel;
      components.forkModel = (source, target) => {
        fork(source, target);
        const family = roots.get(source);
        if (family) roots.set(target, family);
      };
      const previous = components.loadComponent;
      components.loadComponent = (parent, name, doc, inherit, run, itemModel) => {
        const outer = compiling;
        const family = (compiling ??= roots.get(parent) ?? new Map());
        roots.set(parent, family);
        try {
          const result = previous ? previous(parent, name, doc, inherit, run, itemModel) : run(doc);
          if (result.model) {
            family.set(name, result.model);
            roots.set(result.model, family);
            result.model.doc.name = name;
          }
          return result;
        } finally {
          compiling = outer;
        }
      };
    }
    if (!registry.has('host')) return hostEdit;
    const get = Object.getOwnPropertyDescriptor(shared.Player.prototype, 'data')!.get!;
    const data = registry.get('data') as DataModule;
    Object.defineProperty(shared.Player.prototype, 'data', {
      configurable: true,
      get(this: Player) {
        const state = data.dataState(this);
        // Host then indexes created/replaced values in the same map used by list consumers.
        if (state) state.modelTypes ??= new WeakMap<object, string>();
        const api = get.call(this) as HostData;
        extend(api, state!);
        return api;
      },
    });
    return hostEdit;
  },
};
