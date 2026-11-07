import type { LayoutElement } from '../../../packages/markup/src/layout.ts';
type Obj = Record<string, unknown>;
// seam(P6-4a): compiler-only hooks live apart from decompiler helpers for tree shaking.
import { dataMarkup as compiler, propertyNames } from '../../markup-hooks/markup/data.ts';
export const dataMarkup = {
  ...compiler,
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
