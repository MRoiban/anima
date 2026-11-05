// Optional component authoring layer. Imports Compiler only as a type so the runtime entry
// can register these hooks without carrying the markup compiler.
import { VERBOSE, ptr, type NodeType } from '@anima-format/core';
import type { Compiler, Form, Kind } from './compile.ts';
import type { Element, Attr } from './xml.ts';
type Json = Record<string, unknown>;
export const componentMarkup = {
  componentForm(el: Element, anima: Form): Form | undefined {
    if (el.name === 'component')
      return {
        attrs: { name: 'name', grid: 'number', viewBox: 4 },
        required: ['name', 'grid'],
        children: anima.children!.filter((n) => !['component', 'meta'].includes(n)),
      };
  },
  form(el: Element, attrs: Record<string, Kind>, required: string[]): void {
    if (el.name === 'instance') {
      required.push('component');
      for (const a of el.attrs) if (!Object.hasOwn(attrs, a.name)) attrs[a.name] = 'value';
    }
  },
  enter(compiler: Compiler, el: Element, children: Element[], p: string): (() => void) | undefined {
    if (el.name !== 'component') return;
    const saved = [compiler.types, compiler.eases, compiler.resolved] as const;
    compiler.types = new Map();
    compiler.eases = new Map(compiler.eases);
    compiler.resolved = new Map();
    {
      const local = new Set<string>();
      for (const c of children)
        if (c.name === 'ease') {
          const n = c.attrs.find((a) => a.name === 'name'),
            curve = c.attrs.find((a) => a.name === 'curve');
          if (n && curve) {
            if (local.has(n.value) || compiler.builtins.includes(n.value))
              compiler.error(
                'duplicate-name',
                p,
                n.valueAt,
                VERBOSE ? 'duplicate component ease' : '',
              );
            local.add(n.value);
            compiler.eases.set(n.value, curve);
          }
        }
      compiler.checkEases(local, p);
    }
    compiler.collectTypes(el, true);
    return () => {
      [compiler.types, compiler.eases, compiler.resolved] = saved;
    };
  },
  node(compiler: Compiler, el: Element, a: Map<string, Attr>, o: Json, p: string): void {
    if (el.name === 'instance') {
      for (const [name, attr] of a)
        if (
          name !== 'id' &&
          !compiler.nodeAttrs(el.name as NodeType).some((a) => a.attr === name)
        ) {
          const inputs = compiler.container(o, 'inputs', p, attr.valueAt);
          compiler.put(
            inputs,
            name,
            /^\{[\s\S]*\}$/.test(attr.value)
              ? attr.value
              : compiler.read(attr, 'value', ptr(p + '/inputs', name)),
            p + '/inputs',
            attr.valueAt,
          );
        }
    }
  },
  finish(doc: Json): void {
    // Library resources referenced from a component are resolved at build time; compiled
    // components are self-contained and the runtime never searches a parent's resource maps.
    for (const component of Object.values((doc.components ?? {}) as Json)) {
      const child = component as Json;
      const text = JSON.stringify(child);
      for (const key of ['colors', 'glyphs']) {
        for (const [name, value] of Object.entries((doc[key] ?? {}) as Json)) {
          if (
            text.includes(JSON.stringify(name)) &&
            !Object.hasOwn((child[key] ?? {}) as Json, name)
          ) {
            ((child[key] ??= {}) as Json)[name] = value;
          }
        }
      }
    }
  },
};
