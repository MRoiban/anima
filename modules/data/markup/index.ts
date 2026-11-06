import type { Compiler, Form } from '../../../packages/markup/src/compile.ts';
import type { Element, Attr } from '../../../packages/markup/src/xml.ts';
import type { LayoutElement } from '../../../packages/markup/src/layout.ts';
type Obj = Record<string, unknown>;
const scalar = (v: string): unknown => {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};
const propertyNames = [
  'number',
  'string',
  'bool',
  'color',
  'trigger',
  'enum',
  'list',
  'model-ref',
  'asset-ref',
];
export const dataMarkup = {
  form(el: Element, base: Form): Form {
    if (el.name === 'anima' || el.name === 'component')
      return {
        ...base,
        attrs: {
          ...base.attrs,
          ...(el.name === 'component' ? { data: 'string' as const } : { data: 'json' as const }),
        },
        children: [...(base.children ?? []), 'model', 'enum', 'instance'],
      };
    if (el.name === 'bind')
      return {
        ...base,
        attrs: {
          ...base.attrs,
          mode: 'string',
          prefer: 'string',
          convert: 'string',
          options: 'json',
        },
      };
    if (el.name === 'model')
      return {
        attrs: { name: 'string', global: 'boolean' },
        required: ['name'],
        children: propertyNames,
      };
    if (
      el.name === 'instance' &&
      el.attrs.some((a) => a.name === 'model') &&
      !el.attrs.some((a) => a.name === 'id')
    )
      return {
        attrs: {
          name: 'string',
          model: 'string',
          default: 'boolean',
          export: 'boolean',
          exported: 'boolean',
          label: 'string',
        },
        required: ['name', 'model'],
        children: ['set'],
      };
    if (el.name === 'set')
      return { attrs: { path: 'string', value: 'string' }, required: ['path', 'value'] };
    if (['string', 'enum', 'list', 'model-ref', 'asset-ref'].includes(el.name))
      return {
        attrs: {
          name: 'string',
          default: 'string',
          min: 'number',
          max: 'number',
          values: 'string',
          enum: 'string',
          system: 'string',
          of: 'string',
          model: 'string',
          type: 'string',
          public: 'boolean',
          label: 'string',
        },
        required: ['name'],
      };
    if (el.attrs.some((a) => a.name.startsWith('data-')))
      return {
        ...base,
        attrs: {
          ...base.attrs,
          ...Object.fromEntries(
            el.attrs
              .filter((a) => a.name.startsWith('data-'))
              .map((a) => [a.name, 'string' as const]),
          ),
        },
      };
    return base;
  },
  binding(a: Map<string, Attr>): unknown {
    if (!['mode', 'prefer', 'convert', 'options'].some((k) => a.has(k))) return undefined;
    const out: Obj = { value: a.get('value')?.value ?? '' };
    for (const key of ['mode', 'prefer', 'convert', 'options'])
      if (a.has(key)) out[key] = key === 'options' ? scalar(a.get(key)!.value) : a.get(key)!.value;
    return out;
  },
  rootChild(c: Compiler, el: Element, o: Obj, p: string): boolean {
    const isInstance =
      el.name === 'instance' &&
      el.attrs.some((a) => a.name === 'model') &&
      !el.attrs.some((a) => a.name === 'id');
    if (el.name !== 'model' && !isInstance && el.name !== 'enum') return false;
    const a = c.attrs(el, p);
    const children = c.children(el, p);
    const data = c.container(o, 'data', p, el.at);
    const kind = el.name === 'model' ? 'models' : isInstance ? 'instances' : 'enums';
    const map = c.container(data, kind, p + '/data', el.at),
      name = a.get('name')?.value ?? '';
    const at = p + '/data/' + kind + '/' + name;
    if (Object.hasOwn(map, name))
      c.error('duplicate-name', at, el.at, 'duplicate data declaration', 'use a unique name');
    const out: Obj = {};
    for (const [key, v] of a)
      if (key !== 'name')
        out[key === 'export' ? 'exported' : key] =
          key === 'values'
            ? v.value.trim().startsWith('[')
              ? scalar(v.value)
              : v.value.trim().split(/\s+/)
            : scalar(v.value);
    if (el.name === 'model') {
      const properties: Obj = {};
      out.properties = properties;
      for (const child of children) {
        const ca = new Map(child.attrs.map((a) => [a.name, a]));
        const allowed = [
          'name',
          'default',
          'value',
          'convert',
          'min',
          'max',
          'values',
          'enum',
          'system',
          'of',
          'model',
          'type',
          'public',
          'label',
        ];
        for (const a of child.attrs)
          if (!allowed.includes(a.name))
            c.error(
              'unknown-attribute',
              at + '/properties',
              a.at,
              'unknown property attribute',
              'use a declared property field',
            );
        if (!propertyNames.includes(child.name))
          c.error(
            'unknown-element',
            at + '/properties',
            child.at,
            'unknown property type',
            'use a supported property element',
          );
        const key = ca.get('name')?.value ?? '';
        const point = at + '/properties/' + key;
        if (Object.hasOwn(properties, key))
          c.error(
            'duplicate-name',
            point,
            child.at,
            'duplicate property',
            'use a unique property name',
          );
        const property: Obj = { type: child.name };
        for (const [k, v] of ca)
          if (k !== 'name')
            property[k === 'type' ? 'assetType' : k] =
              k === 'value' || k === 'convert'
                ? v.value
                : k === 'values'
                  ? v.value.trim().split(/\s+/)
                  : scalar(v.value);
        properties[key] = property;
        c.map.set(point, child.at);
        for (const [k, v] of ca)
          c.map.set(point + '/' + (k === 'type' ? 'assetType' : k), v.valueAt);
      }
    } else if (isInstance) {
      const values: Obj = {};
      out.values = values;
      for (const child of children) {
        const ca = c.attrs(child, at + '/values');
        c.children(child, at + '/values');
        const key = ca.get('path')?.value ?? '';
        if (Object.hasOwn(values, key))
          c.error(
            'duplicate-name',
            at + '/values/' + key,
            child.at,
            'duplicate initial value',
            'set each value once',
          );
        values[key] = scalar(ca.get('value')?.value ?? '');
        c.map.set(at + '/values/' + key, ca.get('value')?.valueAt ?? child.at);
      }
    }
    map[name] = el.name === 'enum' ? out.values : out;
    c.map.set(at, el.at);
    return true;
  },
  node(el: Element, o: Obj): void {
    for (const a of el.attrs)
      if (a.name.startsWith('data-')) {
        const props = (o.properties ??= {}) as Obj;
        props[a.name.slice(5)] = scalar(a.value);
        Reflect.deleteProperty(o, a.name);
      }
  },
  attributes(name: string): string[] {
    return ['anima', 'component', 'model', 'instance', 'set', 'bind', ...propertyNames].includes(
      name,
    )
      ? [
          'name',
          'global',
          'model',
          'default',
          'export',
          'exported',
          'label',
          'min',
          'max',
          'values',
          'enum',
          'system',
          'of',
          'type',
          'public',
          'path',
          'value',
          'mode',
          'prefer',
          'convert',
          'options',
          'data',
        ]
      : [];
  },
  rootAttrs(d: Obj): [string, string][] {
    const data = d.data as Obj | undefined;
    if (!data) return [];
    if (typeof data === 'string') return [['data', data]];
    const metadata = Object.fromEntries(
      Object.entries(data).filter(([key]) => !['models', 'instances', 'enums'].includes(key)),
    );
    return Object.keys(metadata).length ? [['data', JSON.stringify(metadata)]] : [];
  },
  definitions(d: Obj): LayoutElement[] {
    const data = d.data as Obj | undefined;
    if (!data || typeof data === 'string') return [];
    const entry = (name: string, o: Obj, attrs: [string, string][] = []): LayoutElement => ({
      name,
      attrs: [
        ...attrs,
        ...Object.entries(o)
          .filter(([k]) => k !== '$comment')
          .map(([k, v]): [string, string] => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
      ],
      children: [],
    });
    return [
      ...Object.entries((data.enums ?? {}) as Obj).map(([name, v]) =>
        entry(
          'enum',
          {
            values: (v as unknown[]).some((x) => typeof x === 'object')
              ? JSON.stringify(v)
              : (v as string[]).join(' '),
          },
          [['name', name]],
        ),
      ),
      ...Object.entries((data.models ?? {}) as Record<string, Obj>).map(([name, def]) => {
        const el = entry(
          'model',
          Object.fromEntries(Object.entries(def).filter(([k]) => k !== 'properties')),
          [['name', name]],
        );
        el.children = Object.entries(def.properties as Record<string, Obj>)
          .filter(([k]) => k !== '$comment')
          .map(([key, p]) =>
            entry(
              p.type as string,
              Object.fromEntries(
                Object.entries(p)
                  .filter(([k]) => k !== 'type')
                  .map(([k, v]) => [
                    k === 'assetType' ? 'type' : k,
                    k === 'values'
                      ? (v as string[]).join(' ')
                      : k === 'default' && typeof v === 'string'
                        ? JSON.stringify(v)
                        : v,
                  ]),
              ),
              [['name', key]],
            ),
          );
        return el;
      }),
      ...Object.entries((data.instances ?? {}) as Record<string, Obj>).map(([name, def]) => {
        const el = entry(
          'instance',
          Object.fromEntries(
            Object.entries(def)
              .filter(([k]) => k !== 'values')
              .map(([k, v]) => [k === 'exported' ? 'export' : k, v]),
          ),
          [['name', name]],
        );
        el.children = Object.entries((def.values ?? {}) as Obj).map(([path, value]) =>
          entry('set', { path, value: typeof value === 'string' ? JSON.stringify(value) : value }),
        );
        return el;
      }),
    ];
  },
};
