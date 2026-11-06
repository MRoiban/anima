/** Converter authoring adapter. The data integration can compose rootChild into its
 * compiler hook without making convert depend on data or growing the bind bundle. */
import type { Compiler } from '../../../packages/markup/src/compile.ts';
import type { Element } from '../../../packages/markup/src/xml.ts';
import { options } from '../core/registry.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
export const convertMarkup = {
  rootChild(c: Compiler, el: Element, o: Record<string, unknown>, p: string): boolean {
    if (el.name !== 'converter' && el.name !== 'converter-group') return false;
    const a = c.attrs(el, p + '/converters');
    c.children(el, p + '/converters');
    const name = a.get('name')?.value ?? '';
    const map = c.container(o, 'converters', p, el.at),
      pointer = ptr(p + '/converters', name);
    if (Object.hasOwn(map, name))
      c.error(
        'duplicate-name',
        pointer,
        el.at,
        'duplicate converter',
        'use a unique converter name',
      );
    const d: Record<string, unknown> = {};
    for (const [key, attr] of a) {
      if (key === 'name') continue;
      const shape = options[key];
      d[key] =
        key === 'chain' || shape?.k === 'arr' || shape?.k === 'tup'
          ? attr.value
              .trim()
              .split(/\s+/)
              .map((v) => (shape?.k === 'tup' ? Number(v) : v))
          : c.read(
              attr,
              shape?.k === 'num' ? 'number' : shape?.k === 'bool' ? 'boolean' : 'string',
              ptr(pointer, key),
            );
    }
    c.put(map, name, d, p + '/converters', el.at);
    return true;
  },
};

// Temporary composition adapter until the data module owns the generic root hook.
// Existing event behavior is retained, including its decompiler definitions.
import { VERBOSE } from '../../../packages/core/src/flags.ts';
import { eventsMarkup } from '../../events/markup/index.ts';
import type { LayoutElement } from '../../../packages/markup/src/layout.ts';
const base = { ...eventsMarkup };
const rootChild = convertMarkup.rootChild;
export const converterCompiler = {
  ...eventsMarkup,
  form(el: Element, form: Parameters<typeof eventsMarkup.form>[1]) {
    const result = base.form(el, form);
    return el.name === 'anima' || el.name === 'component'
      ? { ...result, children: [...(result.children ?? []), 'converter', 'converter-group'] }
      : result;
  },
  rootChild(c: Compiler, el: Element, o: Record<string, unknown>, p: string) {
    return rootChild(c, el, o, p) || base.rootChild(c, el, o, p);
  },
  definitions(d: Record<string, unknown>): LayoutElement[] {
    return [
      ...base.definitions(d),
      ...Object.entries((d.converters ?? {}) as Record<string, Record<string, unknown>>)
        .filter(([name]) => name !== '$comment')
        .map(([name, def]): LayoutElement => ({
          name: 'chain' in def ? 'converter-group' : 'converter',
          attrs: [
            ['name', name],
            ...Object.entries(def)
              .filter(([key]) => key !== '$comment')
              .map(([key, value]): [string, string] => [
                key,
                Array.isArray(value) ? value.join(' ') : String(value),
              ]),
          ],
          children: [],
        })),
    ];
  },
};
if (VERBOSE) Object.assign(eventsMarkup, converterCompiler);
