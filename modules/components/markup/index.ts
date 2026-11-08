// seam(P7-5): optional property spelling, eliminated from lean browser markup.
import '../../data-artboard/markup/index.ts';
// Optional component authoring layer. Imports Compiler only as a type so the runtime entry
// can register these hooks without carrying the markup compiler.
import { ptr, type NodeType } from '@anima-format/core';
import type { Compiler, Form, Kind } from '../../../packages/markup/src/compile.ts';
import type { Element, Attr } from '../../../packages/markup/src/xml.ts';
type Json = Record<string, unknown>;
export const componentMarkup = {
  componentForm(el: Element, anima: Form): Form | undefined {
    if (el.name === 'output')
      return { attrs: { name: 'name', value: 'string' }, required: ['name', 'value'] };
    if (el.name === 'component')
      return {
        attrs: { name: 'string', grid: 'number', viewBox: 4, outputs: 'json' },
        required: ['name', 'grid'],
        children: [...anima.children!.filter((n) => n !== 'component' && n !== 'meta'), 'output'],
      };
  },
  form(el: Element, attrs: Record<string, Kind>, required: string[]): void {
    if (el.name === 'repeat') attrs.component = 'string';
    if (el.name === 'instance') {
      required.push('component');
      for (const a of el.attrs) if (!Object.hasOwn(attrs, a.name)) attrs[a.name] = 'value';
    }
  },
  enter(
    compiler: Compiler,
    el: Element,
    _children: Element[],
    p: string,
  ): (() => void) | undefined {
    if (el.name === 'instance') {
      const attr = compiler.nodeAttrs(el.name as NodeType).find((a) => a.attr === 'time');
      if (attr) {
        const shape = attr.shape;
        attr.shape = { k: 'str' };
        return () => {
          attr.shape = shape;
        };
      }
    }
    if (el.name === 'repeat') {
      const attr = compiler.nodeAttrs(el.name as NodeType).find((a) => a.attr === 'component')!;
      const shape = attr.shape;
      attr.shape = { k: 'str' };
      return () => {
        attr.shape = shape;
      };
    }
    if (el.name !== 'component') return;
    for (const [i, output] of _children.entries()) {
      if (output.name !== 'output') continue;
      compiler.attrs(output, p + '/outputs');
      const name = output.attrs.find((a) => a.name === 'name');
      if (name) compiler.map.set(p + '/outputs/' + name.value, name.valueAt);
      _children[i] = {
        ...output,
        name: 'bind',
        attrs: output.attrs.map((a) =>
          a.name === 'name' ? { ...a, name: 'target', value: '@output:' + a.value } : a,
        ),
      };
    }
    const saved = [compiler.types, compiler.eases, compiler.resolved] as const;
    compiler.types = new Map();
    compiler.eases = new Map(compiler.eases);
    compiler.resolved = new Map();
    compiler.collectEases(el, p);
    compiler.collectTypes(el, true);
    return () => ([compiler.types, compiler.eases, compiler.resolved] = saved);
  },
  node(compiler: Compiler, el: Element, a: Map<string, Attr>, o: Json, p: string): void {
    if (el.name === 'repeat' && typeof o.component === 'string') {
      const value = o.component;
      if (value.startsWith('{') || value.startsWith('"')) {
        try {
          o.component = JSON.parse(value);
        } catch {
          /* semantic validation retains the bad name */
        }
      } else if (value.includes(':'))
        o.component = Object.fromEntries(value.split(/\s+/).map((v) => v.split(':')));
    }
    if (el.name === 'instance') {
      // Component references are identifiers even when their shape allows qualified names.
      o.component = (o.component as string | undefined)?.trim();
      const time = a.get('time');
      if (time) {
        let value = time.value;
        let quoted = false;
        if (value.startsWith('"')) {
          try {
            value = JSON.parse(value);
            quoted = true;
          } catch {
            /* semantic expression diagnostic */
          }
        }
        o.time =
          !quoted && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : value;
      }
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
      for (const [key, value] of Object.entries((child.bind ?? {}) as Json))
        if (key.startsWith('@output:')) {
          ((child.outputs ??= {}) as Json)[key.slice(8)] = value;
          Reflect.deleteProperty(child.bind as Json, key);
        }
      if (child.bind && !Object.keys(child.bind).length) delete child.bind;
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
