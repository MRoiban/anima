// Structural markup engine. Node authoring and optional browser modules install it.
import { NAME, VERBOSE, markupName, ptr, type Shape } from '@anima-format/core';
import type { Compiler, Form, Kind } from '../../../packages/markup/src/compile.ts';
import type { Element, Attr } from '../../../packages/markup/src/xml.ts';

const kind = (s: Shape): Kind =>
  s.k === 'alt' && s.of.some((s) => s.k === 'bool') && s.of.some((s) => s.k === 'str')
    ? 'string'
    : ['obj', 'map', 'any', 'alt'].includes(s.k)
      ? 'json'
      : s.k === 'num'
        ? 'number'
        : s.k === 'bool'
          ? 'boolean'
          : s.k === 'str' && s.re === NAME
            ? 'name'
            : 'string';
// Structural arrays contain scalar tokens; tuple arity and enum/range constraints still belong
// to the strict loader. Preserve the attribute origin for each decoded entry.
function readShape(compiler: Compiler, a: Attr, shape: Shape, p: string): unknown {
  if (
    shape.k === 'alt' &&
    shape.of.some((s) => s.k === 'bool') &&
    shape.of.some((s) => s.k === 'str')
  )
    return a.value === 'true' || a.value === 'false' ? a.value === 'true' : a.value;
  if (shape.k === 'arr' && shape.of.k === 'alt') return compiler.read(a, 'lengths', p);
  if (shape.k === 'arr' || shape.k === 'tup') {
    const text = a.value.trim();
    const parts = text ? text.split(/\s*,\s*|\s+/) : [];
    if (parts.some((value) => !value))
      compiler.error(
        'bad-attribute',
        p,
        a.valueAt,
        VERBOSE ? 'expected scalar tokens separated by whitespace or single commas' : '',
        VERBOSE ? 'remove empty list items' : '',
      );
    return parts.map((value, i) =>
      readShape(
        compiler,
        { ...a, value },
        shape.k === 'arr' ? shape.of : (shape.of[i] ?? shape.of[0]!),
        ptr(p, i),
      ),
    );
  }
  return compiler.read(a, kind(shape), p);
}
export const paintMarkup = {
  nodes(compiler: Compiler): string[] {
    return Object.keys(compiler.elements).filter((k) => compiler.elements[k]!.target);
  },
  lengths(compiler: Compiler, s: string): (string | number)[] {
    return s.split(/\s*,\s*|\s+/).map((x) => (x.endsWith('%') ? x : compiler.num(x)));
  },
  hasPaint(compiler: Compiler, el: Element, paint: string): boolean {
    // A registered source attribute can supply a fill without a flat colour attribute.
    if (
      compiler
        .nodeAttrs(el.name as import('@anima-format/core').NodeType)
        .some(
          (a) =>
            a.path[0] === paint && a.path[1] === 'paint' && el.attrs.some((v) => v.name === a.attr),
        )
    )
      return true;
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
    _el: Element,
    children: Element[],
    o: Record<string, unknown>,
    p: string,
  ): void {
    for (const c of children) {
      const form = compiler.elements[c.name];
      if (!form?.target) continue;
      const selector = c.attrs.find((x) => x.name === form.target!.attribute);
      const key = selector?.value ?? form.target!.default;
      if (!form.target!.choices.includes(key)) {
        compiler.error(
          'bad-attribute',
          p,
          selector?.valueAt ?? c.at,
          VERBOSE ? 'invalid structural target' : '',
          VERBOSE ? `choose ${form.target.choices.join(' or ')}` : '',
        );
        continue;
      }
      if (form.target!.array) {
        const list = (o[key] ??= []) as unknown[];
        list.push({
          [form.target!.wrapper!]: compiler.build(
            c,
            ptr(ptr(p, key), list.length) + '/' + form.target!.wrapper,
          ),
        });
        continue;
      }
      let parent = o;
      let pointer = p;
      let present = false;
      for (const part of [key, ...(form.target.path ?? [])]) {
        present = Object.hasOwn(parent, part);
        parent = compiler.container(parent, part, pointer, c.at);
        pointer = ptr(pointer, part);
      }
      if (!form.values && present)
        compiler.error(
          'duplicate-name',
          pointer,
          c.at,
          VERBOSE ? 'object declared twice' : '',
          VERBOSE ? 'keep one child per target' : '',
        );
      if (!form.target.path && (parent.color !== undefined || parent.type !== undefined))
        compiler.error(
          'paint-attribute',
          ptr(p, key),
          c.at,
          VERBOSE ? 'paint already has a colour or gradient' : '',
        );
      Object.assign(parent, compiler.build(c, pointer));
    }
  },
};

export const structuralForms = {
  form(compiler: Compiler, el: Element): Form | undefined {
    const form = compiler.elements[el.name];
    if (form) {
      const attrs: Record<string, Kind> = {};
      const children: string[] = [];
      for (const [k, s] of Object.entries(form.shape.p)) {
        if (s.k === 'arr' && s.of.element) children.push(s.of.element);
        else if (s.k === 'obj' && s.element) children.push(s.element);
        else attrs[markupName(s, k)] = k === 'color' ? 'color' : kind(s);
      }
      if (form.target) attrs[form.target.attribute] = 'string';
      return {
        attrs,
        children,
        required: form.shape.req
          ?.filter(
            (k) =>
              !children.includes(form.shape.p[k]?.element ?? '') &&
              !(form.shape.p[k]?.k === 'arr' && form.shape.p[k].of.element),
          )
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
        if (!list.length && !form.shape.req?.includes(k)) continue;
        compiler.put(o, k, [], p, el.at);
        list.forEach((c, i) => (o[k] as unknown[]).push(compiler.build(c, ptr(ptr(p, k), i))));
      } else if (s.k === 'obj' && s.element) {
        const list = children.filter((c) => c.name === s.element);
        for (const c of list) {
          const target = compiler.elements[c.name]?.target;
          const selector = c.attrs.find((a) => a.name === target?.attribute);
          if (selector && selector.value !== form.target?.wrapper)
            compiler.error(
              'bad-attribute',
              ptr(p, k),
              selector.valueAt,
              VERBOSE ? 'nested paint target must match its wrapper' : '',
              VERBOSE ? 'omit paint or use the enclosing paint kind' : '',
            );
          if (Object.hasOwn(o, k))
            compiler.error(
              'duplicate-name',
              ptr(p, k),
              c.at,
              VERBOSE ? 'object declared twice' : '',
              VERBOSE ? 'keep one child per target' : '',
            );
          else o[k] = compiler.build(c, ptr(p, k));
        }
      } else {
        const attr = a.get(markupName(s, k));
        if (attr)
          compiler.put(
            o,
            k,
            k === 'color'
              ? compiler.read(attr, 'color', ptr(p, k))
              : readShape(compiler, attr, s, ptr(p, k)),
            p,
            attr.valueAt,
          );
      }
    }
  },
};

export const structuralMarkup = { ...paintMarkup, ...structuralForms };
