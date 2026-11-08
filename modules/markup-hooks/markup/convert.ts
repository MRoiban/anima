/** Converter authoring adapter. The data integration can compose rootChild into its
 * compiler hook without making convert depend on data or growing the bind bundle. */
import type { Compiler } from '../../../packages/markup/src/compile.ts';
import type { Element } from '../../../packages/markup/src/xml.ts';
import { options } from '../../convert/core/registry.ts';
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
              shape?.k === 'num' || (key === 'operand' && !attr.value.startsWith('$'))
                ? 'number'
                : shape?.k === 'bool'
                  ? 'boolean'
                  : shape?.k === 'any'
                    ? 'json'
                    : 'string',
              ptr(pointer, key),
            );
    }
    c.put(map, name, d, p + '/converters', el.at);
    return true;
  },
};

import type { Form } from '../../../packages/markup/src/compile.ts';
export const converterCompiler = {
  ...convertMarkup,
  form(el: Element, base: Form): Form {
    return el.name === 'anima' || el.name === 'component'
      ? { ...base, children: [...(base.children ?? []), 'converter', 'converter-group'] }
      : base;
  },
};
