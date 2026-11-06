import type { Module, ModuleRegistry } from '../../../packages/core/src/modules.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { DataState } from '../../data/core/storage.ts';
import type { Property } from '../../data/core/types.ts';
import type { DataInstance, RecordInstance } from '../../host/core/api.ts';
import { clone as copy } from '../../data/core/types.ts';
import { DataError, fail } from '../../host/core/errors.ts';
export class HostValues {
  models: WeakMap<object, string>;
  created: Record<string, { model: string; values: Record<string, unknown> }> = {};
  readonly player: Player;
  scope: DataState;
  shared: ModuleRegistry;
  state: (p: Player) => DataState | undefined;
  records: Map<string, RecordInstance>;
  owned: WeakSet<DataInstance>;
  constructor(
    player: Player,
    scope: DataState,
    shared: ModuleRegistry,
    state: (p: Player) => DataState | undefined,
    records: Map<string, RecordInstance>,
    owned: WeakSet<DataInstance>,
  ) {
    this.player = player;
    this.scope = scope;
    this.shared = shared;
    this.state = state;
    this.records = records;
    this.owned = owned;
    this.models = scope.modelTypes ??= new WeakMap();
  }
  share(value: object, target: DataState, seen = new Set<object>()): void {
    if (seen.has(value)) return;
    seen.add(value);
    const model = this.models.get(value);
    if (model) (target.modelTypes ??= new WeakMap()).set(value, model);
    for (const child of Object.values(value))
      if (child && typeof child === 'object') this.share(child, target, seen);
  }
  index(values: Record<string, unknown>, model: string, raw: Record<string, unknown> = {}): void {
    if (this.models.has(values)) return;
    this.models.set(values, model);
    this.children(this.scope.compiled.document.models[model]!.properties, values, raw);
  }
  children(
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
          ? (this.scope.compiled.document.instances?.[named] ?? this.created[named])
          : undefined;
        const type = fixed ?? instance?.model ?? r?.model;
        if (v && typeof v === 'object' && type)
          this.index(
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
  copy(input: unknown): unknown {
    const seen = new Map<object, unknown>();
    const value = copy(input, seen);
    for (const [source, cloned] of seen) {
      const model = this.models.get(source);
      if (model) this.models.set(cloned as object, model);
    }
    return value;
  }
  values(
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
      if (this.owned.has(value as DataInstance)) return { instance: (value as DataInstance).name };
      const raw = value as { model?: string; values?: Record<string, unknown>; instance?: string };
      if (raw.instance) return value;
      const known = this.models.get(value);
      const model = known ?? raw.model ?? fixed;
      const def = model && this.scope.compiled.document.models[model];
      return def
        ? {
            model,
            values: this.values(
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

  validate(
    def: { properties: Record<string, Property> },
    values: Record<string, unknown>,
  ): Record<string, unknown> {
    values = this.values(def.properties, values);
    const document = this.scope.compiled.document;
    let instanceName = 'hostValue';
    while (this.records.has(instanceName)) instanceName += 'X';
    let name = 'HostValue';
    while (Object.hasOwn(document.models, name)) name += 'X';
    const result = this.shared.load({
      anima: '0.1',
      name: 'host-value',
      grid: 20,
      nodes: [{ id: 'host', type: 'group', children: [] }],
      requires: this.player.model.doc.requires,
      ...(this.player.model.doc.converters ? { converters: this.player.model.doc.converters } : {}),
      ...(this.player.model.doc.assets ? { assets: this.player.model.doc.assets } : {}),
      data: {
        ...document,
        model: name,
        models: { ...document.models, [name]: def },
        instances: {
          ...Object.fromEntries(
            Object.entries({ ...document.instances, ...this.created }).map(([k, v]) => [
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
        .filter(([k]) => this.records.has(k))
        .map(([k, v]) => [v, this.records.get(k)!.values]),
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
    this.children(def.properties, built, values);
    return built;
  }
}
export const hostValues: Module & { Values: typeof HostValues } = {
  name: 'hostvalues',
  entries: [],
  Values: HostValues,
};
