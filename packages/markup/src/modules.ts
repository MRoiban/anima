// Structural markup engine. Node authoring and optional browser modules install it.
import { NAME, VERBOSE, markupName, ptr, type Shape } from '@anima-format/core';
import type { Compiler, Form, Kind } from './compile.ts';
import type { Element, Attr } from './xml.ts';

const kind = (s: Shape): Kind =>
  s.k === 'num'
    ? 'number'
    : s.k === 'bool'
      ? 'boolean'
      : s.k === 'str' && s.re === NAME
        ? 'name'
        : 'string';
export const structuralMarkup = {
  nodes(compiler: Compiler): string[] {
    return Object.keys(compiler.elements).filter((k) => compiler.elements[k]!.target);
  },
  lengths(compiler: Compiler, s: string): (string | number)[] {
    return s.split(/\s*,\s*|\s+/).map((x) => (x.endsWith('%') ? x : compiler.num(x)));
  },
  hasPaint(compiler: Compiler, el: Element, paint: string): boolean {
    return el.children.some(
      (c) =>
        c.kind === 'element' &&
        compiler.elements[c.name]?.target &&
        (c.attrs.find((x) => x.name === compiler.elements[c.name]!.target!.attribute)?.value ??
          compiler.elements[c.name]!.target!.default) === paint,
    );
  },
  node(
    compiler: Compiler,
    el: Element,
    children: Element[],
    o: Record<string, unknown>,
    p: string,
  ): void {
    if (el.name !== 'group')
      for (const c of children) {
        const form = compiler.elements[c.name]!;
        const selector = c.attrs.find((x) => x.name === form.target!.attribute);
        const key = selector?.value ?? form.target!.default;
        if (!form.target!.choices.includes(key)) {
          compiler.error(
            'bad-attribute',
            p,
            selector?.valueAt ?? c.at,
            VERBOSE ? 'invalid paint target' : '',
          );
          continue;
        }
        const parent = compiler.container(o, key, p, c.at);
        if (parent.color !== undefined || parent.type !== undefined)
          compiler.error(
            'paint-attribute',
            ptr(p, key),
            c.at,
            VERBOSE ? 'paint already has a colour or gradient' : '',
          );
        Object.assign(parent, compiler.build(c, ptr(p, key)));
      }
  },
  form(compiler: Compiler, el: Element): Form | undefined {
    const form = compiler.elements[el.name];
    if (form) {
      const attrs: Record<string, Kind> = {};
      const children: string[] = [];
      for (const [k, s] of Object.entries(form.shape.p)) {
        if (s.k === 'arr' && s.of.element) children.push(s.of.element);
        else attrs[markupName(s, k)] = k === 'color' ? 'color' : kind(s);
      }
      if (form.target) attrs[form.target.attribute] = 'string';
      return {
        attrs,
        children,
        required: form.shape.req
          ?.filter((k) => form.shape.p[k]?.k !== 'arr')
          .map((k) => markupName(form.shape.p[k], k)),
      };
    }
    return undefined;
  },
  build(
    compiler: Compiler,
    el: Element,
    a: Map<string, Attr>,
    children: Element[],
    o: Record<string, unknown>,
    p: string,
  ): void {
    const form = compiler.elements[el.name]!;
    for (const [k, v] of Object.entries(form.values ?? {})) compiler.put(o, k, v, p, el.at);
    for (const [k, s] of Object.entries(form.shape.p)) {
      if (s.k === 'arr' && s.of.element) {
        const list = children.filter((c) => c.name === s.of.element);
        compiler.put(o, k, [], p, el.at);
        list.forEach((c, i) => (o[k] as unknown[]).push(compiler.build(c, ptr(ptr(p, k), i))));
      } else {
        const attr = a.get(markupName(s, k));
        if (attr)
          compiler.put(
            o,
            k,
            compiler.read(attr, k === 'color' ? 'color' : kind(s), ptr(p, k)),
            p,
            attr.valueAt,
          );
      }
    }
  },
};
