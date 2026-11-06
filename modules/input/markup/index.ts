import type { Compiler, Form } from '../../../packages/markup/src/compile.ts';
import type { Attr, Element } from '../../../packages/markup/src/xml.ts';
import type { LayoutElement } from '../../../packages/markup/src/layout.ts';
import { listenerFields } from '../core/registry.ts';
type Obj = Record<string, unknown>;
/** Optional compiler hooks; shared compiler call sites are described in HANDOFF.md. */
export const inputMarkup = {
  form(el: Element, base: Form): Form {
    if (el.name !== 'listener') return base;
    const attrs = { ...base.attrs };
    for (const [key, s] of Object.entries(listenerFields))
      attrs[key] = s.k === 'num' ? 'number' : s.k === 'bool' ? 'boolean' : 'string';
    return { ...base, attrs };
  },
  listener(c: Compiler, el: Element, a: Map<string, Attr>, o: Obj, p: string): void {
    if (el.name !== 'listener') return;
    for (const key of Object.keys(listenerFields)) {
      const value = a.get(key);
      if (!value) continue;
      if (key === 'write') {
        const writes: Obj = {};
        for (const token of value.value.trim().split(/\s+/).filter(Boolean)) {
          const m = /^([a-z][a-zA-Z0-9-]*)=([a-z][a-zA-Z0-9-]*)$/.exec(token);
          if (!m || Object.hasOwn(writes, m[1]!))
            c.error(
              'bad-attribute',
              p + '/write',
              value.valueAt,
              'expected unique eventField=input pairs',
              'for example write="x=dragX y=dragY"',
            );
          else writes[m[1]!] = m[2]!;
        }
        c.put(o, key, writes, p, value.valueAt);
      } else
        c.put(
          o,
          key,
          c.read(
            value,
            listenerFields[key]!.k === 'num'
              ? 'number'
              : listenerFields[key]!.k === 'bool'
                ? 'boolean'
                : 'string',
            p + '/' + key,
          ),
          p,
          value.valueAt,
        );
    }
  },
  layout(o: Obj, el: LayoutElement): LayoutElement {
    if (o.write && o.set && !Object.keys(o.set as Obj).length)
      el.attrs = el.attrs.filter(([key]) => key !== 'set');
    for (const key of Object.keys(listenerFields))
      if (o[key] !== undefined)
        el.attrs.push([
          key,
          key === 'write'
            ? Object.entries(o[key] as Obj)
                .map(([field, name]) => `${field}=${name}`)
                .join(' ')
            : String(o[key]),
        ]);
    return el;
  },
};
