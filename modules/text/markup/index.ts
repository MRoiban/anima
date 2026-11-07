import type { Compiler } from '../../../packages/markup/src/compile.ts';
import type { Element } from '../../../packages/markup/src/xml.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
function putStyle(
  compiler: Compiler,
  map: Record<string, unknown>,
  key: string,
  value: unknown,
  p: string,
  c: Element,
) {
  if (Object.hasOwn(map, key))
    compiler.error(
      'duplicate-name',
      ptr(p, key),
      c.at,
      V ? 'text style declared twice' : '',
      V ? 'use a unique style id' : '',
    );
  else compiler.put(map, key, value, p, c.at);
}
export const textMarkup = {
  rootChild(compiler: Compiler, c: Element, o: Record<string, unknown>, p: string): boolean {
    const form = compiler.elements[c.name];
    if (!form?.root || !form.mapKey) return false;
    const built = compiler.build(c, p + '/' + form.root) as Record<string, unknown>;
    const key = String(built[form.mapKey]);
    Reflect.deleteProperty(built, form.mapKey);
    putStyle(
      compiler,
      compiler.container(o, form.root, p, c.at),
      key,
      built,
      p + '/' + form.root,
      c,
    );
    return true;
  },
  node(
    compiler: Compiler,
    _el: Element,
    children: Element[],
    o: Record<string, unknown>,
    p: string,
  ): Element[] {
    return children.filter((c) => {
      const target = compiler.elements[c.name]?.target;
      if (!target || (!target.mapKey && !(target.array && !target.wrapper))) return true;
      const key = target.default;
      if (target.mapKey) {
        const built = compiler.build(c, ptr(p, key)) as Record<string, unknown>;
        const name = String(built[target.mapKey]);
        Reflect.deleteProperty(built, target.mapKey);
        putStyle(compiler, compiler.container(o, key, p, c.at), name, built, ptr(p, key), c);
      } else {
        const list = (o[key] ??= []) as unknown[];
        list.push(compiler.build(c, ptr(ptr(p, key), list.length)));
      }
      return false;
    });
  },
};
