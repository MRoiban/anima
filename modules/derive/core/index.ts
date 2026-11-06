import type { Module } from '../../../packages/core/src/modules.ts';
import type { ObjShape } from '../../../packages/core/src/registry.ts';
import type { Model, Value } from '../../../packages/core/src/load.ts';
import type { Diags } from '../../../packages/core/src/diag.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import type { DataModule } from '../../data/core/index.ts';
import type { Property } from '../../data/core/types.ts';
import type { DataState } from '../../data/core/storage.ts';
import { accepts, normalize, inputFor } from '../../data/core/storage.ts';
import type { Expression } from '../../bind/core/expression.ts';
import { after } from '../manifest.ts';

export const derive: Module = {
  name: 'derive',
  after,
  entries: [],
  init(registry, shared) {
    const data = registry.get('data') as DataModule | undefined;
    const bind = registry.get('bind') as typeof import('../../bind/core/index.ts').bind | undefined;
    if (!data || !bind) return derive;
    const shape = (shared.DOC as ObjShape).p.data as ObjShape;
    const models = shape.p.models as Extract<
      import('../../../packages/core/src/registry.ts').Shape,
      { k: 'map' }
    >;
    const properties = (models.of as ObjShape).p.properties as typeof models;
    const property = properties.of as ObjShape;

    return {
      ...derive,
      init: undefined,
      entries: [
        {
          target: 'document',
          shapes: {
            data: {
              ...shape,
              p: {
                ...shape.p,
                models: {
                  ...models,
                  of: {
                    ...(models.of as ObjShape),
                    p: {
                      ...(models.of as ObjShape).p,
                      properties: {
                        ...properties,
                        of: {
                          ...property,
                          p: {
                            ...property.p,
                            value: { k: 'str', feature: 'derive' },
                            convert: { k: 'str', feature: 'convert' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ],
      prepare(model, d) {
        prepare(model, d, data, bind);
      },
    };
  },
};

function prepare(
  model: Model,
  d: Diags,
  data: DataModule,
  bind: typeof import('../../bind/core/index.ts').bind,
): void {
  if (!model.doc.requires?.includes('derive')) return;
  const c = data.compiled.get(model);
  if (!c) return;
  for (const [path, ref] of [...c.refs]) {
    if (ref.property.type !== 'string') continue;
    const property: Property = { type: 'number' };
    const input = inputFor(property, String(ref.input.def).length, path + '.length', true);
    c.refs.set(path + '.length', {
      ...ref,
      keys: [...ref.keys, 'length'],
      property,
      input,
      readonly: true,
    });
    model.inputs.set(path + '.length', input);
  }
  const defs = c.document.models;
  const plans = new Map<Property, Expression>();
  const points = new Map<Property, string>();
  const error = (code: string, at: string, message: string) =>
    d.err(
      code,
      at,
      V && message,
      V &&
        (code === 'read-only-path'
          ? 'write the source properties instead of the computed property'
          : 'use acyclic scalar expressions with matching types and declared converters'),
    );
  const types = new Map([...model.inputs].map(([n, i]) => [n, i.type as string]));
  const relative = (name: string, prefix = '$', stack: string[] = []): void => {
    if (stack.includes(name)) return;
    for (const [key, p] of Object.entries(defs[name]?.properties ?? {})) {
      if (p.type === 'model-ref') relative(p.model!, prefix + key + '.', [...stack, name]);
      else if (!['list', 'trigger'].includes(p.type))
        types.set(prefix + key, p.type === 'enum' ? 'string' : p.type);
      if (p.type === 'string') types.set(prefix + key + '.length', 'number');
    }
  };
  for (const [name, def] of Object.entries(defs)) {
    // Local names shadow only the default aliases, never explicit $instance:path names.
    for (const key of types.keys())
      if (key.startsWith('$') && !key.includes(':')) types.delete(key);
    relative(name);
    for (const ref of c.refs.values()) {
      let object: unknown = c.defaults[ref.instance];
      for (let i = 0; i < ref.keys.length; i++) {
        if (object && typeof object === 'object' && c.modelOf.get(object) === name)
          types.set('$' + ref.keys.slice(i).join('.'), ref.input.type);
        object = object && (object as Record<string, unknown>)[ref.keys[i]!];
      }
    }

    for (const [key, p] of Object.entries(def.properties)) {
      const at = ptr(ptr('/data/models', name) + '/properties', key);
      if (p.value === undefined) {
        if (p.convert)
          error('derive-type', at + '/convert', 'convert requires a computed value expression');
        continue;
      }
      points.set(p, at);
      if (!['number', 'string', 'bool', 'color', 'enum'].includes(p.type)) {
        error('derive-type', at + '/value', 'only scalar properties can be computed');
        continue;
      }
      if (!model.doc.requires.includes('bind'))
        error('undeclared-feature', at + '/value', 'computed expressions require bind');
      if (
        p.convert &&
        (!model.doc.requires.includes('convert') ||
          !Object.hasOwn(model.doc.converters ?? {}, p.convert))
      )
        error('derive-converter', at + '/convert', 'declare convert and a named converter');
      try {
        const e = bind.parse(p.value, types);
        const expected = p.type === 'enum' ? 'string' : p.type;
        if (!p.convert && e.type !== expected && !(expected === 'number' && e.type === 'bool'))
          error('derive-type', at + '/value', `expected ${expected}, got ${e.type}`);
        plans.set(p, e);
      } catch (e) {
        const err = e as Error & { code?: string; at?: number };
        d.err(
          err.code ?? 'bind-syntax',
          at + '/value',
          V && err.message,
          V &&
            `check token ${JSON.stringify(p.value.slice(err.at ?? 0).match(/^\S+/)?.[0] ?? 'end of expression')}; use typed values, arithmetic, comparisons, and/or/not or registered calls`,
        );
      }
    }
  }
  if (!plans.size) return;
  const propertyAt = (name: string, path: string): Property | undefined => {
    const m = /^\$(?:([\w-]+):)?(.+)$/.exec(path);
    if (!m) return;
    if (m[1]) name = c.document.instances?.[m[1]]?.model ?? '';
    const keys = m[2]!.split('.');
    let p: Property | undefined;
    for (let i = 0; i < keys.length; i++) {
      p = defs[name]?.properties[keys[i]!];
      if (p?.type === 'string' && keys[i + 1] === 'length') return p;
      if (p?.type === 'model-ref') name = p.model!;
      else if (p?.type === 'list') {
        name = p.of!;
        i++;
      }
    }
    return p;
  };
  const visiting = new Set<Property>(),
    done = new Set<Property>();
  const owner = new Map<Property, string>();
  for (const [name, def] of Object.entries(defs))
    for (const p of Object.values(def.properties)) owner.set(p, name);
  const cycle = (p: Property): void => {
    if (visiting.has(p)) {
      error('derive-cycle', points.get(p)! + '/value', 'cyclic computed property dependency');
      return;
    }
    if (done.has(p)) return;
    visiting.add(p);
    for (const input of plans.get(p)?.inputs ?? []) {
      const q = propertyAt(owner.get(p)!, input);
      if (q && plans.has(q)) cycle(q);
    }
    visiting.delete(p);
    done.add(p);
  };
  for (const p of plans.keys()) cycle(p);

  for (const r of c.refs.values())
    if (r.property.value !== undefined) {
      r.readonly = true;
      r.input.readonly = true;
    }
  // Reject writes before core compiles actions, preserving the exact authored pointer.
  const scan = (value: unknown, at: string): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, v] of Object.entries(value)) {
      if (key === 'components' || key === 'data') continue;
      const point = ptr(at, key);
      if (['set', 'toggle', 'write'].includes(key)) {
        const targets =
          key === 'set'
            ? Object.keys(v as object)
            : key === 'write'
              ? Object.values(v as object)
              : Array.isArray(v)
                ? v
                : [v];
        for (const target of targets)
          if (c.refs.get(String(target))?.property.value !== undefined)
            error(
              'read-only-path',
              key === 'set' ? ptr(point, String(target)) : point,
              'computed destination is read-only',
            );
      }
      if (
        key === 'copy' &&
        typeof v === 'string' &&
        c.refs.get(v.split('->')[1]?.trim() ?? '')?.property.value !== undefined
      )
        error('read-only-path', point, 'computed copy destination is read-only');
      if (key === 'bind' && v && typeof v === 'object')
        for (const [target, b] of Object.entries(v))
          if (
            b &&
            typeof b === 'object' &&
            ['to-source', 'two-way'].includes((b as { mode: string }).mode) &&
            c.refs.get((b as { value: string }).value)?.property.value !== undefined
          )
            error(
              'read-only-path',
              ptr(point, target),
              'computed reverse binding destination is read-only',
            );
      scan(v, point);
    }
  };
  scan(model.doc, '');
  // Resolve properties through model metadata, including list items created later by the host.
  const step = (s: DataState, dt: number, report = false): void => {
    const done = new WeakMap<object, Set<string>>(),
      active = new WeakMap<object, Set<string>>();
    const read = (object: Record<string, unknown>, name: string, keys: string[]): unknown => {
      if (!object) return undefined;
      name = s.modelTypes?.get(object) ?? name;
      if (!keys.length) return object;
      const [key, ...tail] = keys,
        p = defs[name]?.properties[key!];
      if (!p) return undefined;
      const e = plans.get(p);
      if (e && !done.get(object)?.has(key!)) {
        let pending = active.get(object);
        if (!pending) active.set(object, (pending = new Set()));
        if (pending.has(key!)) {
          if (report)
            error('derive-cycle', points.get(p)! + '/value', 'cyclic computed property dependency');
          return object[key!];
        }
        pending.add(key!);
        const get = (path: string): unknown => {
          const m = /^\$(?:([\w-]+):)?(.+)$/.exec(path);
          if (!m) return s.get(path);
          const instance = m[1];
          return instance
            ? read(
                s.instances[instance]!,
                c.document.instances![instance]?.model ?? '',
                m[2]!.split('.'),
              )
            : read(object, name, m[2]!.split('.'));
        };
        if (report)
          for (const input of e.inputs)
            if (get(input) === undefined)
              error(
                'data-path',
                points.get(p)! + '/value',
                'unknown instance-relative path ' + input,
              );
        let value = e.evaluate({ get } as ReadonlyMap<string, Value>);
        if (p.convert && !report)
          value = data.converters.get(p.convert)!(
            value,
            {},
            {
              player: s.player!,
              dt,
              direction: 'forward',
              get,
              state: s.converterState,
              key: points.get(p)! + ':' + ids(object),
            },
          ) as Value;
        if (!report) {
          if (p.type === 'number' && typeof value === 'boolean') value = Number(value);
          if (typeof value === 'number' && !Number.isFinite(value)) value = 0;
          if (!accepts(p, value)) throw new Error('anima: derive-type ' + points.get(p));
          value = normalize(p, value);
        }
        object[key!] = value;
        pending.delete(key!);
        let seen = done.get(object);
        if (!seen) done.set(object, (seen = new Set()));
        seen.add(key!);
      }
      const value = object[key!];
      if (!tail.length) return value;
      if (p.type === 'string' && tail.length === 1 && tail[0] === 'length')
        return String(value).length;
      if (p.type === 'model-ref') return read(value as Record<string, unknown>, p.model!, tail);
      if (p.type === 'list') {
        const [index, ...rest] = tail;
        if (index === 'length') return (value as unknown[]).length;
        return read((value as Record<string, unknown>[])[+index!]!, p.of!, rest);
      }
      return undefined;
    };
    const visit = (
      object: Record<string, unknown>,
      name: string,
      seen = new Set<object>(),
    ): void => {
      if (!object || seen.has(object)) return;
      name = s.modelTypes?.get(object) ?? name;
      seen.add(object);
      for (const [key, p] of Object.entries(defs[name]?.properties ?? {})) {
        read(object, name, [key]);
        if (p.type === 'model-ref') visit(object[key] as Record<string, unknown>, p.model!, seen);
        if (p.type === 'list')
          for (const v of object[key] as Record<string, unknown>[]) visit(v, p.of!, seen);
      }
    };
    for (const [name, values] of Object.entries(s.instances))
      visit(values, c.document.instances![name]?.model ?? '');
  };
  const identity = new WeakMap<object, number>();
  let next = 0;
  const ids = (o: object) => {
    if (!identity.has(o)) identity.set(o, ++next);
    return identity.get(o)!;
  };
  // Instance overrides must not initialize derived slots, including nested list values.
  const initial = (name: string, values: Record<string, unknown>, at: string): void => {
    for (const [key, v] of Object.entries(values)) {
      const p = defs[name]?.properties[key] ?? propertyAt(name, '$' + key);
      if (!p) continue;
      if (p.value !== undefined)
        error('read-only-path', ptr(at, key), 'computed initial value is read-only');
      if (p.type === 'list' && Array.isArray(v))
        v.forEach((x, i) => {
          if (x && typeof x === 'object')
            initial(x.model ?? p.of!, x.values ?? x, ptr(at, key) + '/' + i);
        });
      if (p.type === 'model-ref' && v && typeof v === 'object')
        initial(
          p.model!,
          (v as { values?: Record<string, unknown> }).values ?? (v as Record<string, unknown>),
          ptr(at, key),
        );
    }
  };
  for (const [name, i] of Object.entries(c.document.instances ?? {}))
    initial(i.model, i.values ?? {}, ptr('/data/instances', name) + '/values');
  if (d.list.some((x) => x.severity === 'error')) return;
  // Validate cycles against the concrete default graph without running stateful converters.
  step(
    {
      instances: c.defaults,
      modelTypes: c.modelOf,
      get: (path: string) => model.inputs.get(path)?.def,
    } as unknown as DataState,
    0,
    true,
  );
  const factory = model.inputScope!;
  model.inputScope = (p) => {
    const s = factory(p) as DataState;
    s.modelTypes = new WeakMap();
    const seen = new WeakSet<object>();
    const index = (source: unknown, target: unknown): void => {
      if (
        !source ||
        typeof source !== 'object' ||
        !target ||
        typeof target !== 'object' ||
        seen.has(source)
      )
        return;
      seen.add(source);
      const name = c.modelOf.get(source);
      if (name) s.modelTypes!.set(target, name);
      for (const [key, value] of Object.entries(source))
        index(value, (target as Record<string, unknown>)[key]);
    };
    index(c.defaults, s.instances);

    for (const input of model.inputs.values())
      if (!c.refs.has(input.name) && input.type !== 'trigger') s.set(input.name, input.def);
    step(s, 0);
    s.initial = new Map(
      [...c.refs]
        .filter(([, r]) => r.property.value !== undefined)
        .map(([path]) => [path, s.get(path)!]),
    );
    return s;
  };
  const previous = model.resolveBindings;
  model.resolveBindings = (p, values, scope, dt) => {
    step(scope as DataState, dt);
    previous?.(p, values, scope, dt);
  };
}
