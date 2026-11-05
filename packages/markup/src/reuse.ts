// Build-time reuse only. No library/template data reaches the runtime document.
import { NAME, VERBOSE } from '@anima-format/core';
import type { CompileOptions, MarkupDiagnostic } from './index.ts';
import {
  escapeText,
  parseXml,
  type Child,
  type Element,
  type Pos,
  type XmlDocument,
} from './xml.ts';

import { location } from './library-hooks.ts';

declare const URL: { new (path: string, base: string): { href: string } };

export const attr = (el: Element, name: string): string =>
  el.attrs.find((a) => a.name === name)?.value ?? '';

/** Host resolvers receive a normalised path relative to the importing file (or an absolute URL). */
export function importPath(path: string, file = ''): string {
  if (/^[a-z]+:/i.test(file)) return new URL(path, file).href;
  if (/^[a-z]+:/i.test(path)) return path;
  const parts: string[] = [];
  const joined = path.startsWith('/') ? path : file.slice(0, file.lastIndexOf('/') + 1) + path;
  for (const part of joined.split('/')) {
    if (part === '..' && parts.length && parts.at(-1) !== '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return (joined.startsWith('/') ? '/' : '') + parts.join('/');
}

type Scope = Map<string, Definition>;
interface Definition {
  el: Element;
  scope: Scope;
  name: string;
}

export function expand(
  xml: XmlDocument,
  opts: CompileOptions,
  diagnostics: MarkupDiagnostic[],
): void {
  const resources: Element[] = [];
  const active = new Set<string>([opts.file ?? '']);
  const root = xml.root!;
  const names = new Set<string>();
  const scan = (el: Element) => {
    names.add(attr(el, 'name'));
    for (const c of el.children) if (c.kind === 'element') scan(c);
  };
  scan(root);
  let serial = 0;
  const error = (code: string, at: Pos, message: string, related?: Pos) => {
    diagnostics.push({
      code,
      severity: 'error',
      pointer: '',
      message: VERBOSE ? message : code,
      file: at.file ?? opts.file,
      line: at.line,
      column: at.col,
      ...((related ?? at.related) ? { related: relatedLocations((related ?? at.related)!) } : {}),
      ...(VERBOSE ? { hint: 'check the declaration and its import or apply site' } : {}),
    });
  };
  const annotate = (el: Element, file: string | undefined, doc: XmlDocument, related?: Pos) => {
    const mark = (at: Pos) => Object.assign(at, { file, related, locate: doc.pos });
    mark(el.at);
    for (const a of el.attrs) {
      mark(a.at);
      mark(a.valueAt);
    }
    for (const c of el.children) {
      if (c.kind === 'element') annotate(c, file, doc, related);
      else mark(c.at);
    }
  };
  const scopeFor = (el: Element, file: string | undefined, imported = false): Scope => {
    const scope: Scope = new Map();
    const aliases = new Set<string>();
    for (const c of el.children) {
      if (c.kind !== 'element') continue;
      if (c.name === 'import') {
        const src = attr(c, 'src'),
          alias = attr(c, 'as');
        if (!src || !NAME.test(alias)) {
          error('bad-attribute', c.at, VERBOSE ? 'import needs src and a valid as name' : '');
          continue;
        }
        if (aliases.has(alias))
          error('duplicate-name', c.at, VERBOSE ? 'duplicate import alias' : '');
        aliases.add(alias);
        const path = importPath(src, file);
        if (active.has(path)) {
          error('import-cycle', c.at, VERBOSE ? `import cycle at ${path}` : '');
          continue;
        }
        let source: string;
        try {
          if (!opts.resolve) throw Error();
          source = opts.resolve(path);
        } catch {
          error('unknown-import', c.at, VERBOSE ? `cannot read import ${path}` : '');
          continue;
        }
        const parsed = parseXml(source);
        for (const e of parsed.errors)
          error('markup-syntax', { ...e.at, file: path }, e.message, c.at);
        if (!parsed.doc.root) continue;
        annotate(parsed.doc.root, path, parsed.doc, c.at);
        if (parsed.doc.root.name !== 'library') {
          error(
            'bad-import',
            parsed.doc.root.at,
            VERBOSE ? 'imported root must be <library>' : '',
            c.at,
          );
          continue;
        }
        if (!NAME.test(attr(parsed.doc.root, 'name')))
          error(
            'bad-attribute',
            parsed.doc.root.at,
            VERBOSE ? 'library needs a valid name' : '',
            c.at,
          );
        active.add(path);
        const exports = scopeFor(parsed.doc.root, path, true);
        active.delete(path);
        for (const [key, value] of exports) {
          const [kind, local] = key.split(' ');
          const name = `${kind} ${alias}:${local}`;
          if (scope.has(name))
            error('duplicate-name', c.at, VERBOSE ? `duplicate imported name ${name}` : '');
          else scope.set(name, value);
        }
      } else if (['template', 'color', 'glyph', 'ease', 'component'].includes(c.name)) {
        const name = attr(c, 'name');
        const key = `${c.name} ${name}`;
        if (!NAME.test(name))
          error('bad-attribute', c.at, VERBOSE ? 'declaration needs a valid name' : '');
        if (scope.has(key)) error('duplicate-name', c.at, VERBOSE ? `duplicate name ${name}` : '');
        let output = name;
        if (imported && c.name !== 'template') {
          do {
            output = `import-${++serial}-${name}`;
          } while (names.has(output));
          names.add(output);
        }
        scope.set(key, { el: c, scope, name: output });
        if (c.name === 'component')
          error(
            'components-unavailable',
            c.at,
            VERBOSE ? 'components arrive with the components module' : '',
          );
      } else if (imported)
        error('misplaced-element', c.at, VERBOSE ? `<${c.name}> is not allowed in a library` : '');
    }
    if (imported)
      for (const d of scope.values()) {
        if (d.scope === scope && ['color', 'glyph', 'ease'].includes(d.el.name)) {
          const copy = clone(d.el, {}, scope, []);
          if (copy.kind === 'element') {
            copy.attrs.find((a) => a.name === 'name')!.value = d.name;
            resources.push(copy);
          }
        }
      }
    return scope;
  };
  const reference = (value: string, kind: string, scope: Scope, at: Pos): string => {
    const d = scope.get(`${kind} ${value}`);
    if (d && d.el.name === kind) return d.name;
    if (value.includes(':') && /^[a-z][\w-]*:/.test(value))
      error('unknown-name', at, VERBOSE ? `unknown ${kind} ${value}` : '');
    return value;
  };
  const clone = (
    c: Child,
    params: Record<string, string>,
    scope: Scope,
    uses: Pos[],
    track = false,
  ): Child => {
    const subst = (s: string) =>
      s.replace(/\{([a-z][\w-]*)\}/g, (all, key: string) => params[key] ?? all);
    const origin = (at: Pos): Pos => ({ ...at, ...(uses.length ? { related: uses.at(-1) } : {}) });
    if (c.kind !== 'element') {
      if (c.kind === 'comment') return { ...c, at: origin(c.at) };
      const rewrite = (s: string, report = false) =>
        track
          ? s.replace(/[a-z][\w-]*(?::[a-z][\w-]*)*/g, (name) => {
              const d = scope.get(`color ${name}`) ?? scope.get(`ease ${name}`);
              if (!d && name.includes(':') && report)
                error('unknown-name', origin(c.at), VERBOSE ? `unknown name ${name}` : '');
              return d?.name ?? name;
            })
          : s;
      const offsets: number[] = [];
      let raw = '',
        end = 0;
      for (const m of c.raw.matchAll(/\{([a-z][\w-]*)\}|[a-z][\w-]*(?::[a-z][\w-]*)*/g)) {
        const prefix = c.raw.slice(end, m.index);
        raw += prefix;
        for (let i = end; i < m.index; i++) offsets.push(c.at.offset + i);
        const replacement = m[1]
          ? escapeText(rewrite(params[m[1]] ?? m[0], true))
          : rewrite(m[0], true);
        raw += replacement;
        for (let i = 0; i < replacement.length; i++) offsets.push(c.at.offset + m.index);
        end = m.index + m[0].length;
      }
      raw += c.raw.slice(end);
      for (let i = end; i < c.raw.length; i++) offsets.push(c.at.offset + i);
      return { ...c, value: rewrite(subst(c.value)), raw, offsets, at: origin(c.at) };
    }
    const out = {
      ...c,
      at: origin(c.at),
      attrs: c.attrs.map((a) => ({
        ...a,
        at: origin(a.at),
        valueAt: origin(a.valueAt),
        value: subst(a.value),
      })),
      children: [] as Child[],
    };
    for (const a of out.attrs) {
      const kind =
        a.name === 'glyph'
          ? 'glyph'
          : ['fill', 'stroke', 'stop-color', 'value'].includes(a.name)
            ? 'color'
            : ['ease', 'curve'].includes(a.name)
              ? 'ease'
              : '';
      if (kind) a.value = reference(a.value, kind, scope, a.valueAt);
      if (out.name === 'pose') a.value = reference(a.value, 'color', scope, a.valueAt);
    }
    out.children = children(c.children, params, scope, uses, c.name === 'track');
    return out;
  };
  const stack = new Set<Definition>();
  const children = (
    items: Child[],
    params: Record<string, string>,
    scope: Scope,
    uses: Pos[],
    track = false,
  ): Child[] =>
    items.flatMap((c): Child[] => {
      if (c.kind !== 'element') return [clone(c, params, scope, uses, track)];
      if (['import', 'template'].includes(c.name)) return [];
      if (c.name !== 'apply') return [clone(c, params, scope, uses)];
      if (
        c.children.some(
          (child) => child.kind === 'element' || (child.kind === 'text' && child.value.trim()),
        )
      )
        error('misplaced-element', c.at, VERBOSE ? 'apply must be empty' : '');
      const use = clone({ ...c, children: [] }, params, scope, uses) as Element;
      const name = attr(use, 'template'),
        d = scope.get(`template ${name}`);
      if (!d || d.el.name !== 'template') {
        error('unknown-name', use.at, VERBOSE ? `unknown template ${name}` : '');
        return [];
      }
      if (stack.has(d)) {
        error('template-recursion', d.el.at, VERBOSE ? `recursive template ${name}` : '', use.at);
        return [];
      }
      const values: Record<string, string> = Object.create(null) as Record<string, string>;
      const declared = new Set<string>();
      for (const token of attr(d.el, 'params').split(/\s+/).filter(Boolean)) {
        const [key, ...rest] = token.split('=');
        if (!NAME.test(key!)) {
          error('bad-attribute', d.el.at, VERBOSE ? 'invalid parameter name' : '', use.at);
          continue;
        }
        if (declared.has(key!))
          error('duplicate-name', d.el.at, VERBOSE ? 'duplicate parameter' : '', use.at);
        declared.add(key!);
        const supplied = use.attrs.find((a) => a.name === key);
        if (supplied) values[key!] = supplied.value;
        else if (rest.length) values[key!] = rest.join('=');
        else error('missing-parameter', d.el.at, VERBOSE ? `missing parameter ${key}` : '', use.at);
        const pattern = new RegExp(`\\{${key}\\}`);
        if (!pattern.test(JSON.stringify(d.el.children)))
          error('unused-parameter', d.el.at, VERBOSE ? `unused parameter ${key}` : '', use.at);
      }
      for (const a of use.attrs)
        if (a.name !== 'template' && !declared.has(a.name))
          error('unknown-parameter', d.el.at, VERBOSE ? `unknown parameter ${a.name}` : '', a.at);
      const check = (node: Child) => {
        if (node.kind === 'comment') return;
        const strings = node.kind === 'text' ? [node.value] : node.attrs.map((a) => a.value);
        for (const s of strings)
          for (const m of s.matchAll(/\{([a-z][\w-]*)\}/g))
            if (!declared.has(m[1]!))
              error(
                'unknown-parameter',
                node.at,
                VERBOSE ? `undeclared parameter ${m[1]}` : '',
                use.at,
              );
        if (node.kind === 'element') node.children.forEach(check);
      };
      d.el.children.forEach(check);
      stack.add(d);
      const result = children(d.el.children, values, d.scope, [...uses, use.at]);
      stack.delete(d);
      return result;
    });
  annotate(root, opts.file, xml);
  const scope = scopeFor(root, opts.file);
  root.children = [...resources, ...children(root.children, {}, scope, [])];
}

function relatedLocations(at: Pos): ReturnType<typeof location>[] {
  return [location(at), ...(at.related ? relatedLocations(at.related) : [])];
}
