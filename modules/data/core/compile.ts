import type { DataModule } from './index.ts';
import { guards } from './guards.ts';
import { dataCodes } from './errors.ts';
import { clone } from './types.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { Diags } from '../../../packages/core/src/diag.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { compiled, type DataDocument, type Property, type Compiled } from './types.ts';
import { systemEnums } from './enums.ts';
import { accepts, normalize, inputFor, createScope, dataState } from './storage.ts';
export const paths = /\$[a-zA-Z][\w-]*(?::[a-zA-Z][\w-]*)?(?:\.[\w-]+)*/g;
export function prepare(model: Model, d: Diags, context?: DataModule['prepareContext']): void {
  if (
    !model.doc.requires?.includes('data') ||
    !model.doc.data ||
    typeof model.doc.data === 'string'
  )
    return;
  const document = clone(model.doc.data) as DataDocument;
  const error = (
    code: string,
    p: string,
    message: string,
    hint = 'check the data model, instance and property declaration',
  ) => d.err(code, p, V && message, V && hint);
  const defs = document.models;
  const ownEntries = <T>(o: Record<string, T> | undefined) =>
    Object.entries(o ?? {}).filter(([k]) => k !== '$comment');
  const name = /^[a-zA-Z][\w-]*$/;
  for (const [key, values] of ownEntries(document.enums)) {
    const keys = values.map((v) => (typeof v === 'string' ? v : v.key));
    if (keys.some((k) => !name.test(k)) || new Set(keys).size !== keys.length)
      error(dataCodes['enum'], ptr('/data/enums', key), 'enum keys must be unique names');
  }
  for (const [key, def] of ownEntries(defs)) {
    if (!name.test(key))
      error(dataCodes['model'], ptr('/data/models', key), 'model names must be identifiers');
    for (const [key2, p] of ownEntries(def.properties)) {
      const at = ptr(ptr('/data/models', key) + '/properties', key2);
      if (!name.test(key2)) error(dataCodes['property'], at, 'property names must be identifiers');
      if (p.type === 'component')
        p.values = Object.keys(model.doc.components ?? {}).filter((n) => n !== '$comment');
      if (p.type === 'enum') {
        const values = p.system
          ? systemEnums[p.system]
          : p.enum
            ? document.enums?.[p.enum]?.map((v) => (typeof v === 'string' ? v : v.key))
            : p.values;
        if (!values?.length || new Set(values).size !== values.length)
          error(dataCodes['enum'], at, 'enum needs unique members or a declared system enum');
        p.values = [...(values ?? [])];
      }
      if (
        (p.min !== undefined && p.type !== 'number') ||
        (p.max !== undefined && p.type !== 'number') ||
        (p.min ?? -Infinity) > (p.max ?? Infinity)
      )
        error(dataCodes['property'], at, 'number limits must be ordered and numeric');
      if (
        (p.type === 'model-ref' && !Object.hasOwn(defs, p.model ?? '')) ||
        (p.type === 'list' && p.of && !Object.hasOwn(defs, p.of))
      )
        error(dataCodes['model'], at, 'unknown referenced model');
      if (p.type === 'asset-ref' && !p.assetType)
        error(dataCodes['property'], at, 'asset-ref needs assetType image, font or blob');
    }
  }
  let expanded = 0;
  const modelOf = new WeakMap<object, string>();
  const named = new Map<string, Record<string, unknown>>();
  const resolving = new Set<string>();
  const namedInstance = (key: string, at: string): Record<string, unknown> => {
    if (named.has(key)) return named.get(key)!;
    if (resolving.has(key)) {
      error(dataCodes['cycle'], at, 'cyclic instance reference');
      return {};
    }
    const instance = document.instances?.[key];
    if (!instance) {
      error(dataCodes['instance'], at, 'unknown instance ' + key);
      return {};
    }
    resolving.add(key);
    const value = build(instance.model, instance.values, at);
    resolving.delete(key);
    named.set(key, value);
    return value;
  };
  const build = (
    modelName: string,
    overrides: Record<string, unknown> = {},
    at: string,
    stack: string[] = [],
  ): Record<string, unknown> => {
    const def = Object.hasOwn(defs, modelName) ? defs[modelName] : undefined;
    if (!def) {
      error(dataCodes['model'], at, 'unknown model ' + modelName);
      return {};
    }
    if (stack.length >= 32 || ++expanded > 4096) {
      error('limit-exceeded', at, 'data expansion exceeds 32 levels or 4096 objects');
      return {};
    }
    const out: Record<string, unknown> = {};
    modelOf.set(out, modelName);
    for (const k of Object.keys(overrides))
      if (!def.properties[k] && k !== '$comment')
        error(dataCodes['path'], ptr(at, k), 'unknown property ' + k);
    for (const [k, p] of ownEntries(def.properties)) {
      const loc = ptr(at, k);
      let value = Object.hasOwn(overrides, k) ? overrides[k] : p.default;
      if (p.type === 'trigger') {
        if (value !== undefined)
          error(
            dataCodes['type'],
            loc,
            'triggers have no stored value',
            'use fire with the trigger path',
          );
        continue;
      }
      if (p.type === 'model-ref' || p.type === 'list') {
        const item = (
          v: unknown,
          of: string | undefined,
          point: string,
        ): Record<string, unknown> => {
          if (typeof v === 'string') {
            const instance = document.instances?.[v];
            if (!instance) {
              error(dataCodes['instance'], point, 'unknown instance ' + v);
              return {};
            }
            if (of && instance.model !== of)
              error(dataCodes['type'], point, 'instance model does not match reference');
            if (stack.includes('@' + v)) {
              error(dataCodes['cycle'], point, 'cyclic instance reference');
              return {};
            }
            return namedInstance(v, point);
          }
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            const o = v as { model?: string; instance?: string; values?: Record<string, unknown> };
            if (o.instance) return item(o.instance, of, point);
            if (o.model && of && o.model !== of)
              error(dataCodes['type'], point, 'item model does not match list of');
            return build(o.model ?? of ?? '', o.values ?? (v as Record<string, unknown>), point, [
              ...stack,
              modelName,
            ]);
          }
          if (stack.includes(modelName)) {
            error(
              dataCodes['cycle'],
              point,
              'recursive default model reference',
              'provide an acyclic explicit instance graph',
            );
            return {};
          }
          return build(of ?? '', {}, point, [...stack, modelName]);
        };
        if (p.type === 'list') {
          if (value !== undefined && !Array.isArray(value))
            error(dataCodes['type'], loc, 'list values must be arrays');
          out[k] = (Array.isArray(value) ? value : []).map((v, i) => item(v, p.of, loc + '/' + i));
        } else out[k] = item(value, p.model, loc);
        continue;
      }
      if (value === undefined)
        value =
          p.type === 'number'
            ? 0
            : p.type === 'bool'
              ? false
              : p.type === 'color'
                ? '#000000'
                : p.type === 'enum'
                  ? p.values?.[0]
                  : '';
      if (p.type === 'component' && value && !p.values?.includes(String(value)))
        error(
          'unknown-component',
          loc,
          'component property names an unknown component',
          'use a declared component name or empty string',
        );
      if (!accepts(p, value))
        error(
          dataCodes['type'],
          loc,
          'value does not match ' + p.type,
          'use a value with the declared property type',
        );
      else {
        if (
          p.type === 'number' &&
          p.value === undefined &&
          (Number(value) < (p.min ?? -Infinity) || Number(value) > (p.max ?? Infinity))
        )
          error(dataCodes['type'], loc, 'initial value lies outside number limits');
        if (
          p.type === 'asset-ref' &&
          value &&
          model.doc.assets?.[String(value)]?.type !== p.assetType
        )
          error(
            dataCodes['asset'],
            loc,
            'asset reference kind does not match',
            'declare an asset of the requested kind',
          );
        out[k] = normalize(p, value);
      }
    }
    return out;
  };
  const defaults: Compiled['defaults'] = {};
  let chosen = '';
  for (const [key, instance] of ownEntries(document.instances)) {
    if (!name.test(key))
      error(
        dataCodes['instance'],
        ptr('/data/instances', key),
        'instance names must be identifiers',
      );
    defaults[key] = namedInstance(key, ptr('/data/instances', key) + '/values');
    if (instance.default) {
      if (chosen)
        error(
          dataCodes['instance'],
          ptr('/data/instances', key) + '/default',
          'only one default instance is allowed',
        );
      chosen = key;
    }
  }
  const target = document.model;
  if (target && !defs[target]) error(dataCodes['model'], '/data/model', 'unknown default model');
  if (target)
    chosen =
      ownEntries(document.instances).find(([, v]) => v.model === target && v.default)?.[0] ??
      ownEntries(document.instances).find(([, v]) => v.model === target)?.[0] ??
      '';
  if (!chosen) chosen = Object.keys(defaults)[0] ?? '';
  if (!chosen || (target && document.instances?.[chosen]?.model !== target)) {
    chosen = 'default';
    const modelName = target ?? Object.keys(defs).find((k) => k !== '$comment');
    if (!modelName) {
      error(dataCodes['model'], '/data/models', 'at least one model is required');
      return;
    }
    (document.instances ??= {})[chosen] = { model: modelName };
    defaults[chosen] = build(modelName, {}, '/data/models/' + modelName + '/properties');
  }
  if (document.preview && !defaults[document.preview])
    error(dataCodes['instance'], '/data/preview', 'unknown preview instance');
  for (const [i, n] of model.nodes.entries())
    if (n.raw.data && !model.doc.requires.includes('lists')) {
      const key = String(n.raw.data).replace(/^\$/, '').replace(/:$/, '');
      const inst = document.instances?.[key];
      if (!inst)
        error(dataCodes['instance'], '/nodes/' + i + '/data', 'unknown component data instance');
      const publicModel = model.doc.components?.[n.raw.component]?.data;
      if (inst && typeof publicModel === 'string' && publicModel !== inst.model)
        error(
          dataCodes['type'],
          '/nodes/' + i + '/data',
          'component public data model does not match',
        );
    }
  const c: Compiled = { document, defaults, defaultName: chosen, refs: new Map(), model, modelOf };
  compiled.set(model, c);
  const flatten = (
    instance: string,
    modelName: string,
    values: Record<string, unknown>,
    prefix: string,
    keys: string[],
    depth = 0,
  ) => {
    if (depth > 32) return;
    for (const [k, p] of ownEntries(defs[modelName]?.properties)) {
      const path = prefix + k,
        steps = [...keys, k],
        value = values[k];
      if (p.type === 'model-ref') {
        if (value)
          flatten(
            instance,
            p.model!,
            value as Record<string, unknown>,
            path + '.',
            steps,
            depth + 1,
          );
      } else if (p.type === 'list') {
        const list = (value ?? []) as Record<string, unknown>[];
        const property: Property = { type: 'number' };
        const input = inputFor(property, list.length, path + '.length', true);
        c.refs.set(path + '.length', {
          instance,
          keys: [...steps, 'length'],
          property,
          readonly: true,
          input,
        });
        model.inputs.set(path + '.length', input);
        list.forEach((v, i) => {
          const itemModel = p.of ?? modelOf.get(v);
          if (itemModel)
            flatten(instance, itemModel, v, path + '.' + i + '.', [...steps, String(i)], depth + 1);
        });
      } else {
        const input = inputFor(p, value, path);
        c.refs.set(path, { instance, keys: steps, property: p, input });
        model.inputs.set(path, input);
      }
    }
  };
  for (const [key, values] of Object.entries(defaults))
    flatten(key, document.instances![key]!.model, values, '$' + key + ':', []);
  for (const [path, r] of [...c.refs])
    if (r.instance === chosen) {
      const alias = '$' + path.split(':')[1];
      c.refs.set(alias, r);
      model.inputs.set(alias, r.input);
    }
  context?.(model, d);
  guards(model);
  // Validate all authored path uses with their own JSON pointers, including writes and event fields.
  const scan = (v: unknown, at: string) => {
    if (typeof v === 'string') {
      // Guard string literals are values, not references to the paths they may spell.
      const source = at.endsWith('/when') ? v.replace(/"(?:[^"\\]|\\.)*"/g, '') : v;
      for (const path of source.match(paths) ?? []) {
        if (!c.refs.has(path)) {
          // Whole lists/model references are legitimate converter sources, never scalar inputs.
          const m = /^\$(?:([\w-]+):)?(.+)$/.exec(path)!;
          let value: unknown = defaults[m[1] ?? chosen];
          for (const k of m[2]!.split('.')) value = value && (value as Record<string, unknown>)[k];
          if (value === undefined)
            error(
              dataCodes['path'],
              at,
              'unknown data path ' + path,
              'use a declared property, named instance or valid list index',
            );
        }
      }
    } else if (Array.isArray(v)) v.forEach((x, i) => scan(x, at + '/' + i));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (k === '$comment' || k === 'components' || k === 'data') continue;
        scan(k, ptr(at, k));
        scan(x, ptr(at, k));
      }
  };
  scan(model.doc, '');
  model.inputScope = createScope;
  model.signal = (p, name) => {
    const s = dataState(p)!;
    s.signals.set(name, (s.signals.get(name) ?? 0) + 1);
  };
  model.bindData = (parent, child, node) => {
    const a = dataState(parent),
      b = dataState(child);
    if (!a || !b) return;
    for (const [key, inst] of Object.entries(b.compiled.document.instances ?? {}))
      if (defs[inst.model]?.global && a.instances[key]) b.instances[key] = a.instances[key]!;
    if (node.raw.data) {
      const source = a.instances[String(node.raw.data).replace(/^\$/, '').replace(/:$/, '')];
      if (source) b.instances[b.compiled.defaultName] = source;
    }
  };
}
