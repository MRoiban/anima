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
    message: string | false,
    hint: string | false = 'check the data model, instance and property declaration',
  ) => d.err(code, p, V && message, V && hint);
  const defs = document.models;
  const ownEntries = <T>(o: Record<string, T> | undefined) =>
    Object.entries(o ?? {}).filter(([k]) => k !== '$comment');
  const name = /^[a-zA-Z][\w-]*$/;
  for (const [key, values] of ownEntries(document.enums)) {
    const keys = values.map((v) => (typeof v === 'string' ? v : v.key));
    if (keys.some((k) => !name.test(k)) || new Set(keys).size !== keys.length)
      error(dataCodes['enum'], ptr('/data/enums', key), V && 'enum keys must be unique names');
  }
  for (const [key, def] of ownEntries(defs)) {
    if (!name.test(key))
      error(dataCodes['model'], ptr('/data/models', key), V && 'model names must be identifiers');
    for (const [key2, p] of ownEntries(def.properties)) {
      const at = ptr(ptr('/data/models', key) + '/properties', key2);
      if (!name.test(key2))
        error(dataCodes['property'], at, V && 'property names must be identifiers');
      if (p.type === 'text-style' && !model.doc.requires?.includes('text'))
        error(
          'undeclared-feature',
          at + '/type',
          V && 'text-style requires text',
          V && 'add text to requires',
        );
      if (p.type === 'text-style')
        p.values = Object.keys(model.doc.textStyles ?? {}).filter((n) => n !== '$comment');
      if (p.type === 'component')
        p.values = Object.keys(model.doc.components ?? {}).filter((n) => n !== '$comment');
      if (p.type === 'enum') {
        const values = p.system
          ? systemEnums[p.system]
          : p.enum
            ? document.enums?.[p.enum]?.map((v) => (typeof v === 'string' ? v : v.key))
            : p.values;
        if (!values?.length || new Set(values).size !== values.length)
          error(dataCodes['enum'], at, V && 'enum needs unique members or a declared system enum');
        p.values = [...(values ?? [])];
      }
      if (
        (p.min !== undefined && p.type !== 'number') ||
        (p.max !== undefined && p.type !== 'number') ||
        (p.min ?? -Infinity) > (p.max ?? Infinity)
      )
        error(dataCodes['property'], at, V && 'number limits must be ordered and numeric');
      if (
        (p.type === 'model-ref' && !Object.hasOwn(defs, p.model ?? '')) ||
        (p.type === 'list' && p.of && !Object.hasOwn(defs, p.of))
      )
        error(dataCodes['model'], at, V && 'unknown referenced model');
      if (p.type === 'asset-ref' && !p.assetType)
        error(
          dataCodes['property'],
          at,
          V && 'asset-ref needs assetType image, audio, font or blob',
        );
    }
  }
  let expanded = 0;
  const modelOf = new WeakMap<object, string>();
  const named = new Map<string, Record<string, unknown>>();
  const resolving = new Set<string>();
  const namedInstance = (key: string, at: string): Record<string, unknown> => {
    if (named.has(key)) return named.get(key)!;
    if (resolving.has(key)) {
      error(dataCodes['cycle'], at, V && 'cyclic instance reference');
      return {};
    }
    const instance = document.instances?.[key];
    if (!instance) {
      error(dataCodes['instance'], at, V && 'unknown instance ' + key);
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
      error(dataCodes['model'], at, V && 'unknown model ' + modelName);
      return {};
    }
    if (stack.length >= 32 || ++expanded > 4096) {
      error('limit-exceeded', at, V && 'data expansion exceeds 32 levels or 4096 objects');
      return {};
    }
    const out: Record<string, unknown> = {};
    modelOf.set(out, modelName);
    for (const k of Object.keys(overrides))
      if (!def.properties[k] && k !== '$comment')
        error(dataCodes['path'], ptr(at, k), V && 'unknown property ' + k);
    for (const [k, p] of ownEntries(def.properties)) {
      const loc = ptr(at, k);
      let value = Object.hasOwn(overrides, k) ? overrides[k] : p.default;
      if (p.type === 'trigger') {
        if (value !== undefined)
          error(
            dataCodes['type'],
            loc,
            V && 'triggers have no stored value',
            V && 'use fire with the trigger path',
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
              error(dataCodes['instance'], point, V && 'unknown instance ' + v);
              return {};
            }
            if (of && instance.model !== of)
              error(dataCodes['type'], point, V && 'instance model does not match reference');
            if (stack.includes('@' + v)) {
              error(dataCodes['cycle'], point, V && 'cyclic instance reference');
              return {};
            }
            return namedInstance(v, point);
          }
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            const o = v as { model?: string; instance?: string; values?: Record<string, unknown> };
            if (o.instance) return item(o.instance, of, point);
            if (o.model && of && o.model !== of)
              error(dataCodes['type'], point, V && 'item model does not match list of');
            return build(o.model ?? of ?? '', o.values ?? (v as Record<string, unknown>), point, [
              ...stack,
              modelName,
            ]);
          }
          if (stack.includes(modelName)) {
            error(
              dataCodes['cycle'],
              point,
              V && 'recursive default model reference',
              V && 'provide an acyclic explicit instance graph',
            );
            return {};
          }
          return build(of ?? '', {}, point, [...stack, modelName]);
        };
        if (p.type === 'list') {
          if (value !== undefined && !Array.isArray(value))
            error(dataCodes['type'], loc, V && 'list values must be arrays');
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
          V && 'component property names an unknown component',
          V && 'use a declared component name or empty string',
        );
      if (!accepts(p, value))
        error(
          dataCodes['type'],
          loc,
          V && 'value does not match ' + p.type,
          V && 'use a value with the declared property type',
        );
      else {
        if (
          p.type === 'number' &&
          p.value === undefined &&
          (Number(value) < (p.min ?? -Infinity) || Number(value) > (p.max ?? Infinity))
        )
          error(dataCodes['type'], loc, V && 'initial value lies outside number limits');
        if (
          p.type === 'asset-ref' &&
          value &&
          model.doc.assets?.[String(value)]?.type !== p.assetType
        )
          error(
            dataCodes['asset'],
            Object.hasOwn(overrides, k)
              ? loc
              : ptr(ptr('/data/models', modelName) + '/properties', k) + '/default',
            V && 'asset reference kind does not match',
            V && 'declare an asset of the requested kind',
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
        V && 'instance names must be identifiers',
      );
    defaults[key] = namedInstance(key, ptr('/data/instances', key) + '/values');
    if (instance.default) {
      if (chosen)
        error(
          dataCodes['instance'],
          ptr('/data/instances', key) + '/default',
          V && 'only one default instance is allowed',
        );
      chosen = key;
    }
  }
  const target = document.model;
  if (target && !defs[target])
    error(dataCodes['model'], '/data/model', V && 'unknown default model');
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
      error(dataCodes['model'], '/data/models', V && 'at least one model is required');
      return;
    }
    (document.instances ??= {})[chosen] = { model: modelName };
    defaults[chosen] = build(modelName, {}, '/data/models/' + modelName + '/properties');
  }
  if (document.preview && !defaults[document.preview])
    error(dataCodes['instance'], '/data/preview', V && 'unknown preview instance');
  for (const [i, n] of model.nodes.entries())
    if (n.raw.data && !model.doc.requires.includes('lists')) {
      const key = String(n.raw.data).replace(/^\$/, '').replace(/:$/, '');
      const inst = document.instances?.[key];
      if (!inst)
        error(
          dataCodes['instance'],
          '/nodes/' + i + '/data',
          V && 'unknown component data instance',
        );
      const publicModel = model.doc.components?.[n.raw.component]?.data;
      if (inst && typeof publicModel === 'string' && publicModel !== inst.model)
        error(
          dataCodes['type'],
          '/nodes/' + i + '/data',
          V && 'component public data model does not match',
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
      // Run text is a data source only as a whole `$path` (text module); otherwise literal.
      if (/\/runs\/\d+\/text$/.test(at) && v[0] !== '$') return;
      // Quoted string literals (guards and expressions) are values, not references to paths.
      const source = v.replace(/"(?:[^"\\]|\\.)*"/g, '');
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
              V && 'unknown data path ' + path,
              V && 'use a declared property, named instance or valid list index',
            );
        }
      }
    } else if (Array.isArray(v)) v.forEach((x, i) => scan(x, at + '/' + i));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (k === '$comment' || k === 'components' || k === 'data') continue;
        // Event payload string fields and node custom properties stay literal.
        if (
          (k === 'value' &&
            (v as { type?: string }).type === 'string' &&
            /\/payload\/[^/]+$/.test(at)) ||
          (k === 'properties' && 'id' in v)
        )
          continue;
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
      if ((child.model.inheritedData || defs[inst.model]?.global) && a.instances[key])
        b.instances[key] = a.instances[key]!;
    // seam(P7-5): foreign inherited models may use a different default instance name.
    if (
      child.model.inheritedData &&
      typeof node.raw.component === 'string' &&
      String(a.read(node.raw.component)).startsWith('$external:')
    )
      b.instances[b.compiled.defaultName] = a.instances[a.compiled.defaultName]!;
    if (node.raw.data) {
      const source = a.instances[String(node.raw.data).replace(/^\$/, '').replace(/:$/, '')];
      if (source) b.instances[b.compiled.defaultName] = source;
    }
    // Lists already walks descendants after installing its item/default context.
    if (model.doc.requires.includes('lists')) return;
    // Children are constructed bottom-up; refresh descendants after rebinding this child.
    const nested = child.nested as
      { players?: Map<string, import('../../../packages/core/src/player.ts').Player> } | undefined;
    for (const [id, grandchild] of nested?.players ?? []) {
      const placement = child.model.nodes.find((n) => n.id === id);
      if (placement) child.model.bindData?.(child, grandchild, placement);
    }
  };
}
