// AniML → .ani. Syntax/authoring conveniences live here; the strict core loader remains the
// authority on semantic validity (references, property types, ranges, and reserved features).
// Guard diagnostic arguments too: browser builds fold their text and suggestion work away;
// Node/CLI keep VERBOSE=true and the full authoring diagnostics (SPEC §2).
import {
  NAME,
  ELEMENTS,
  NODE_TYPES,
  nodeShape,
  VERBOSE,
  formatAni,
  load,
  parseEase,
  parseHex,
  suggest,
  ptr,
  type NodeType,
  type Shape,
} from '@anima-format/core';
import { libraryCompiler, location } from './library-hooks.ts';
import {
  moduleCompiler,
  textCompiler,
  componentCompiler,
  bindCompiler,
  motionCompiler,
  eventsCompiler,
  dataCompiler,
  convertCompiler,
} from './module-hooks.ts';
import { elementFields, compoundField } from './fields.ts';
import { componentMarkup } from './components.ts';

import type { CompileOptions, CompileResult, MarkupDiagnostic } from './index.ts';
import { aniAddress, nodeAttrs, type NodeAttr } from './names.ts';
import { parseXml, type Attr, type Element, type Pos, type XmlDocument } from './xml.ts';

type Json = Record<string, unknown>;
export type Kind =
  | 'json'
  | 'mixed'
  | 'string'
  | 'name'
  | 'number'
  | 'boolean'
  | 'value'
  | 'color'
  | 'names'
  | 'indices'
  | 'lengths'
  | 'set'
  | 'ease'
  | 'json'
  | 'condition'
  | number;
export interface Form {
  attrs: Record<string, Kind>;
  required?: string[];
  children?: readonly string[];
}
const NODES: readonly string[] = NODE_TYPES;
const BUILTINS = 'linear hold in out inOut'.split(' ');
const FORMS: Record<string, Form> = {
  anima: {
    attrs: {
      version: 'string',
      name: 'string',
      title: 'string',
      grid: 'number',
      viewBox: 4,
      requires: 'names',
      xmlns: 'string',
    },
    required: ['version', 'name', 'grid'],
    children: [
      'meta',
      'color',
      'glyph',
      'asset',
      'a11y',
      'bool',
      'number',
      'trigger',
      'hit',
      ...NODES,
      'ease',
      'timeline',
      'layer',
      'listener',
      'bind',
      'component',
    ],
  },
  meta: { attrs: {} },
  color: { attrs: { name: 'name', value: 'color' }, required: ['name', 'value'] },
  glyph: {
    attrs: { name: 'name', d: 'string', source: 'string', pick: 'string', sha256: 'string' },
    required: ['name', 'd'],
  },
  a11y: {
    attrs: { role: 'string', label: 'string', activate: 'name', pressed: 'name', held: 'name' },
  },
  bool: { attrs: { name: 'name', default: 'boolean' }, required: ['name'] },
  number: {
    attrs: { name: 'name', default: 'number', min: 'number', max: 'number' },
    required: ['name'],
  },
  trigger: { attrs: { name: 'name', buffer: 'number' }, required: ['name'] },
  hit: { attrs: { circle: 3, rect: 4 } },
  ease: { attrs: { name: 'name', curve: 'ease' }, required: ['name', 'curve'] },
  timeline: {
    attrs: { name: 'name', colorSpace: 'string' },
    required: ['name', 'duration'],
    children: ['track', 'event'],
  },
  track: { attrs: { target: 'string' }, required: ['target'] },
  event: { attrs: { at: 'number', name: 'name' }, required: ['at', 'name'] },
  layer: {
    attrs: { name: 'name', mode: 'string' },
    required: ['name', 'initial'],
    children: ['state'],
  },
  state: { attrs: { name: 'name' }, required: ['name'], children: ['pose', 'on'] },
  pose: { attrs: {} },
  on: { attrs: {}, required: ['when', 'to'] },
  listener: { attrs: {}, required: ['on'] },
};
if (VERBOSE)
  FORMS.component = componentMarkup.componentForm({ name: 'component' } as Element, FORMS.anima!)!;
const IS_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

const object = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);
const own = (o: Json, k: string, v: unknown) =>
  Object.defineProperty(o, k, { value: v, enumerable: true, configurable: true, writable: true });

export class Compiler {
  readonly elements = ELEMENTS;
  readonly builtins = BUILTINS;
  readonly diagnostics: MarkupDiagnostic[] = [];
  readonly map = new Map<string, Pos>();
  types = new Map<string, NodeType>();
  // Registry descriptors are stable during one compile. Reuse them for nodes and addresses,
  // but start fresh next time so modules registered between compiles are always visible.
  private readonly fieldCache = new Map<string, ReturnType<typeof elementFields>>();
  private fields(name: string) {
    let fields = this.fieldCache.get(name);
    if (!fields) this.fieldCache.set(name, (fields = elementFields(name)));
    return fields;
  }
  private readonly attributes = new Map<NodeType, NodeAttr[]>();
  nodeAttrs = (type: NodeType): NodeAttr[] => {
    let attrs = this.attributes.get(type);
    if (!attrs) this.attributes.set(type, (attrs = nodeAttrs(type)));
    return attrs;
  };
  eases = new Map<string, Attr>();
  resolved = new Map<string, string>();
  private readonly resolving = new Set<string>();
  private readonly finalEases: { key: unknown[]; pointer: string }[] = [];
  private xml: XmlDocument | undefined;
  private opts: CompileOptions;

  constructor(opts: CompileOptions) {
    this.opts = opts;
  }

  error(code: string, p: string, at: Pos, message: string, hint?: string): void {
    this.diagnostics.push({
      code,
      severity: 'error',
      pointer: p,
      message: VERBOSE ? message : code,
      ...(VERBOSE && hint ? { hint } : {}),
      line: at.line,
      column: at.col,
      file: at.file ?? this.opts.file,
      ...(at.related ? { related: [location(at.related)] } : {}),
    });
  }
  get failed(): boolean {
    return this.diagnostics.some((d) => d.severity === 'error');
  }

  // All values, including generated containers and vector entries, get an origin. A later, more
  // specific write (e.g. a keyframe token) overrides the container's default position.
  private mark(p: string, value: unknown, at: Pos): void {
    this.map.set(p, at);
    if (value !== null && typeof value === 'object')
      for (const [k, v] of Object.entries(value)) this.mark(ptr(p, k), v, at);
  }
  put(o: Json, key: string, value: unknown, p: string, at: Pos): void {
    own(o, key, value);
    this.mark(ptr(p, key), value, at);
  }
  container(o: Json, key: string, p: string, at: Pos): Json {
    if (!Object.hasOwn(o, key)) this.put(o, key, {}, p, at);
    return o[key] as Json;
  }
  private append(o: Json, key: string, p: string, at: Pos): [unknown[], string] {
    if (!Object.hasOwn(o, key)) this.put(o, key, [], p, at);
    const a = o[key] as unknown[];
    return [a, ptr(ptr(p, key), a.length)];
  }
  address(s: string): string {
    return aniAddress(s, (id) => this.types.get(id), this.nodeAttrs) ?? s;
  }

  private readonly forms = new WeakMap<Element, Form>();
  private form(el: Element): Form {
    let form = this.forms.get(el);
    if (!form) this.forms.set(el, (form = this.formFor(el)));
    return form;
  }
  private formFor(el: Element): Form {
    if (NODES.includes(el.name)) {
      const attrs: Record<string, Kind> = { id: 'name' };
      const required = ['id'];
      for (const a of this.nodeAttrs(el.name as NodeType)) {
        attrs[a.attr] = a.index === undefined ? this.kind(a.shape) : 'number';
        if ((el.name === 'circle' || el.name === 'arc') && ['cx', 'cy', 'r'].includes(a.attr))
          required.push(a.attr);
        if (el.name === 'arc' && ['from', 'to'].includes(a.attr)) required.push(a.attr);
        if (el.name === 'rect' && ['x0', 'y0', 'width', 'height'].includes(a.attr))
          required.push(a.attr);
      }
      componentCompiler.form?.(el, attrs, required);
      let base: Form = {
        attrs,
        required,
        children: [
          ...(el.name === 'group' ? NODES : []),
          ...(moduleCompiler.nodes?.(this) ?? []).filter((key) =>
            Object.hasOwn(nodeShape(el.name as NodeType).p, this.elements[key]!.target!.default),
          ),
        ],
      };
      base = motionCompiler.form?.(el, base) ?? base;
      return dataCompiler.form?.(el, eventsCompiler.form?.(el, base) ?? base) ?? base;
    }
    let base =
      moduleCompiler.form?.(this, el) ??
      componentCompiler.componentForm?.(el, FORMS.anima!) ??
      FORMS[el.name]!;
    if (base) {
      const attrs = { ...base.attrs };
      for (const f of this.fields(el.name)) {
        if (f.attr !== f.key) Reflect.deleteProperty(attrs, f.key);
        attrs[f.attr] =
          f.key === 'when'
            ? 'condition'
            : f.key === 'ease'
              ? 'ease'
              : ['fire', 'toggle'].includes(f.key)
                ? 'names'
                : f.key === 'set'
                  ? 'set'
                  : compoundField(f.shape)
                    ? 'json'
                    : this.kind(f.shape);
      }
      base = { ...base, attrs };
    }
    const form = motionCompiler.form?.(el, base ?? { attrs: {} }) ?? base;
    const extended = eventsCompiler.form?.(el, form ?? { attrs: {} }) ?? form;
    const converted = convertCompiler.form?.(el, extended ?? { attrs: {} }) ?? extended;
    return dataCompiler.form?.(el, converted ?? { attrs: {} }) ?? converted;
  }
  private kind(s: Shape): Kind {
    if (s.k === 'alt' && s.of.some((s) => s.k === 'str')) return 'mixed';
    if (s.k === 'obj' || s.k === 'map' || s.k === 'any' || s.k === 'alt') return 'json';
    if (s.k === 'num') return 'number';
    if (s.k === 'bool') return 'boolean';
    if (s.k === 'tup') return s.of.length;
    if (s.k === 'arr') return s.of.k === 'alt' ? 'lengths' : 'indices'; // subpaths are a whitespace-separated index list
    return s.k === 'str' && s.re === NAME ? 'name' : 'string';
  }

  attrs(el: Element, p: string): Map<string, Attr> {
    const form = this.form(el);
    const out = new Map<string, Attr>();
    for (const a of el.attrs) {
      if (out.has(a.name))
        this.error(
          'duplicate-attribute',
          p,
          a.at,
          VERBOSE ? `attribute "${a.name}" appears twice` : '',
        );
      else out.set(a.name, a);
      if (el.name !== 'pose' && !Object.hasOwn(form.attrs, a.name))
        this.error(
          'unknown-attribute',
          p,
          a.at,
          VERBOSE ? `<${el.name}> takes no "${a.name}" attribute` : '',
          VERBOSE ? suggest(a.name, Object.keys(form.attrs)) : '',
        );
    }
    for (const name of form.required ?? [])
      if (!out.has(name))
        this.error(
          'missing-attribute',
          p,
          el.at,
          VERBOSE ? `<${el.name}> needs "${name}"` : '',
          VERBOSE ? `add ${name}="…"` : '',
        );
    return out;
  }
  children(el: Element, p: string): Element[] {
    const out: Element[] = [];
    const allowed = [
      ...(this.form(el).children ?? []),
      ...(el.name === 'anima'
        ? Object.keys(this.elements).filter((k) => this.elements[k]!.root)
        : []),
    ];
    for (const c of el.children) {
      if (c.kind === 'text' && c.value.trim() && !['track', 'meta'].includes(el.name))
        this.error(
          'markup-syntax',
          p,
          c.at,
          VERBOSE ? `text is not allowed inside <${el.name}>` : '',
        );
      if (c.kind !== 'element') continue;
      const dataInstance =
        c.name === 'instance' && !!dataCompiler.form?.(c, { attrs: {} }).attrs.model;
      // Tooling installs every hook; missing-layer diagnostics belong to lean browser builds.
      if (!VERBOSE) {
        const feature =
          ['component', 'instance'].includes(c.name) && !dataInstance && !componentCompiler.enter
            ? 'components'
            : c.name === 'bind' && !bindCompiler.build
              ? 'bind'
              : !moduleCompiler.node &&
                  ELEMENTS[c.name]?.target &&
                  !(
                    textCompiler.node &&
                    (ELEMENTS[c.name]!.target!.mapKey ||
                      (ELEMENTS[c.name]!.target!.array && !ELEMENTS[c.name]!.target!.wrapper))
                  )
                ? 'paint'
                : undefined;
        if (feature) {
          const hint = `load @anima-format/web/${feature === 'paint' ? 'markup-paint' : feature} or run anima build`;
          this.diagnostics.push({
            code: `markup-${feature}-unavailable`,
            severity: 'error',
            pointer: p,
            message: hint,
            hint,
            line: c.at.line,
            column: c.at.col,
            file: c.at.file ?? this.opts.file,
          });
        }
        if (feature) continue;
      }
      if (
        !NODES.includes(c.name) &&
        !Object.hasOwn(FORMS, c.name) &&
        c.name !== 'component' &&
        !(['event-def', 'audio-volume'].includes(c.name) && eventsCompiler.form) &&
        !(
          (['model', 'enum', 'string', 'list', 'model-ref', 'asset-ref', 'set'].includes(c.name) ||
            dataInstance) &&
          dataCompiler.form
        ) &&
        !(['channel', 'machine'].includes(c.name) && motionCompiler.form) &&
        !Object.hasOwn(ELEMENTS, c.name)
      )
        this.error(
          'unknown-element',
          p,
          c.at,
          VERBOSE ? `unknown element <${c.name}>` : '',
          VERBOSE ? suggest(c.name, [...Object.keys(FORMS), ...NODES]) : '',
        );
      else if (
        !allowed.includes(c.name) &&
        !(['anima', 'component'].includes(el.name) && NODES.includes(c.name))
      )
        this.error(
          'misplaced-element',
          p,
          c.at,
          VERBOSE ? `<${c.name}> is not allowed inside <${el.name}>` : '',
          VERBOSE ? suggest(c.name, allowed) : '',
        );
      else out.push(c);
    }
    return out;
  }
  private comment(el: Element, o: Json, p: string): void {
    for (const c of el.children) {
      if (c.kind === 'element') break;
      if (c.kind === 'comment') {
        this.put(o, '$comment', c.value.trim(), p, c.at);
        break;
      }
    }
  }

  num(s: string): number {
    const value = Number(s);
    if (!IS_NUMBER.test(s) || !Number.isFinite(value))
      throw new Error(VERBOSE ? 'expected a finite JSON number' : '');
    return value;
  }
  private color(s: string): string {
    if (NAME.test(s) || parseHex(s)) return s;
    throw new Error(VERBOSE ? 'expected a colour literal or slot name' : '');
  }
  private scalar(s: string, color = true): number | boolean | string {
    if (s.startsWith('"')) return JSON.parse(s) as string;
    if (s === 'true' || s === 'false') return s === 'true';
    if (IS_NUMBER.test(s)) return this.num(s);
    if (color && (NAME.test(s) || parseHex(s))) return s;
    throw new Error(
      VERBOSE
        ? color
          ? 'expected a number, boolean or colour'
          : 'expected a number or boolean'
        : '',
    );
  }
  private ease(s: string): string {
    if (this.eases.has(s)) return this.resolveEase(s);
    const m = /^(cubic|elastic)\((.*)\)$/s.exec(s);
    if (!m) return s; // the loader owns bad-ease and reserved diagnostics
    const args = m[2]!.split(',').map((s) => this.num(s.trim()));
    if (args.length !== (m[1] === 'cubic' ? 4 : 2))
      throw new Error(VERBOSE ? 'wrong number of ease arguments' : '');
    return `${m[1]}(${args.join(', ')})`;
  }
  resolveEase(name: string): string {
    if (this.resolved.has(name)) return this.resolved.get(name)!;
    const a = this.eases.get(name)!;
    if (this.resolving.has(name)) {
      this.error(
        'bad-attribute',
        '',
        a.valueAt,
        VERBOSE ? `cyclic ease declaration "${name}"` : '',
      );
      return name;
    }
    this.resolving.add(name);
    const value = this.read(a, 'ease', '');
    this.resolving.delete(name);
    const result = typeof value === 'string' ? value : name;
    this.resolved.set(name, result);
    return result;
  }
  private condition(s: string): string {
    // Replace the word only between terms: an input itself may legally be named "and".
    return s
      .split(/\s+and\s+|\s*&&\s*/)
      .map((t) =>
        t
          .trim()
          .replace(/\s*(==|!=|<=|>=|<|>)\s*/g, ' $1 ')
          .replace(/^!\s+/, '!')
          .replace(/@after\(\s*([^)]*?)\s*\)/g, '@after($1)'),
      )
      .join(' && ');
  }
  read(a: Attr, kind: Kind, p: string): unknown {
    const s = a.value.trim();
    try {
      if (typeof kind === 'number') {
        const parts = s.split(/\s*,\s*|\s+/);
        if (parts.some((x) => !IS_NUMBER.test(x)))
          throw new Error(VERBOSE ? 'expected numbers separated by whitespace or one comma' : '');
        const v = parts.map((x) => this.num(x));
        if (kind && v.length !== kind) throw new Error(VERBOSE ? `expected ${kind} numbers` : '');
        return v;
      }
      switch (kind) {
        case 'json':
          return JSON.parse(s);
        case 'number':
          return this.num(s);
        case 'boolean':
          if (s !== 'true' && s !== 'false')
            throw new Error(VERBOSE ? 'expected true or false' : '');
          return s === 'true';
        case 'name':
          if (!NAME.test(s))
            throw new Error(VERBOSE ? 'expected a name matching [a-z][a-zA-Z0-9-]*' : '');
          return s;
        case 'value':
          return this.scalar(s);
        case 'color':
          return this.color(s);
        case 'lengths':
          return moduleCompiler.lengths?.(this, s);
        case 'indices':
          if (!s) throw new Error(VERBOSE ? 'expected a whitespace-separated index list' : '');
          return s.split(/\s+/).map((x) => this.num(x));
        case 'names': {
          const v = s ? s.split(/\s+/) : [];
          if (
            !v.length ||
            (a.name !== 'requires' &&
              v.some(
                (x) =>
                  !NAME.test(x) &&
                  !(
                    ['fire', 'toggle'].includes(a.name) &&
                    /^(?:\$[\w-]+:)?\$?[a-zA-Z][\w-]*(?:\.[\w-]+)*$/.test(x)
                  ),
              ))
          )
            throw new Error(VERBOSE ? 'expected a whitespace-separated name list' : '');
          return v;
        }
        case 'set': {
          const o: Json = {};
          for (const pair of s
            ? s.split(/\s+(?=(?:\$[\w-]+:)?\$?[a-zA-Z][\w-]*(?:\.[\w-]+)*=)/)
            : []) {
            const m = /^((?:\$[\w-]+:)?\$?[a-zA-Z][\w-]*(?:\.[\w-]+)*)=(.+)$/.exec(pair);
            if (!m)
              throw new Error(
                VERBOSE ? 'expected whitespace-separated name=value assignments' : '',
              );
            if (Object.hasOwn(o, m[1]!))
              throw new Error(VERBOSE ? `repeated assignment "${m[1]}"` : '');
            const source = m[2]!.trim();
            own(
              o,
              m[1]!,
              IS_NUMBER.test(source) || /^(true|false)$/.test(source)
                ? this.scalar(source, false)
                : source,
            );
          }
          return o;
        }
        case 'ease':
          return this.ease(s);
        case 'condition':
          return this.condition(s);
        case 'mixed':
          try {
            return JSON.parse(s);
          } catch {
            return a.value;
          }
        case 'string':
          return a.value;
      }
    } catch (e) {
      this.error(
        'bad-attribute',
        p,
        a.valueAt,
        VERBOSE ? (e instanceof Error ? e.message : 'invalid attribute value') : '',
      );
      return undefined;
    }
  }
  private copy(el: Element, a: Map<string, Attr>, o: Json, p: string, omit: string[] = []): void {
    for (const [name, attr] of a) {
      if (omit.includes(name) || !Object.hasOwn(this.form(el).attrs, name)) continue;
      const key =
        name === 'version'
          ? 'anima'
          : (this.fields(el.name).find((f) => f.attr === name)?.key ?? name);
      let v = this.read(attr, this.form(el).attrs[name]!, ptr(p, key));
      // .ani accepts a scalar for a one-item fire/toggle list (the reference bell uses it).
      if ((name === 'fire' || name === 'toggle') && Array.isArray(v) && v.length === 1) v = v[0];
      if (v !== undefined) this.put(o, key, v, p, attr.valueAt);
    }
  }

  addNamed(o: Json, key: string, el: Element, p: string, at: Pos): boolean {
    if (Object.hasOwn(o, key)) {
      this.error(
        'duplicate-name',
        ptr(p, key),
        at,
        VERBOSE ? `"${key}" is declared twice in this map` : '',
      );
      return false;
    }
    // Do not recursively mark a built object here: its descendants already have precise origins.
    own(o, key, this.build(el, ptr(p, key)));
    return true;
  }
  build(el: Element, p: string): unknown {
    this.map.set(p, el.at);
    if (p === '/a11y') this.forms.set(el, FORMS.a11y!);
    const a = this.attrs(el, p);
    const children = this.children(el, p);
    const o: Json = {};
    const leave = componentCompiler.enter?.(this, el, children, p);
    if (!['track', 'event', 'color', 'ease'].includes(el.name)) this.comment(el, o, p);
    if (NODES.includes(el.name)) {
      this.copyNode(el, a, o, p);
      const rest = textCompiler.node?.(this, el, children, o, p) ?? children;
      moduleCompiler.node?.(this, el, rest, o, p);
      componentCompiler.node?.(this, el, a, o, p);
      motionCompiler.node?.(this, el, children, o, p);
      dataCompiler.node?.(el, o);
      if (el.name === 'group') {
        this.put(o, 'children', [], p, el.at);
        for (const c of children.filter((c) => NODES.includes(c.name))) {
          const list = o.children as unknown[];
          list.push(this.build(c, ptr(p + '/children', list.length)));
        }
      }
    } else if (el.name === 'bind') {
      return dataCompiler.binding?.(a) ?? bindCompiler.build?.(a);
    } else if (ELEMENTS[el.name] && p !== '/a11y') {
      moduleCompiler.build?.(this, el, a, children, o, p);
    } else if (el.name === 'track') {
      this.map.set(p, a.get('target')?.valueAt ?? el.at);
      const keys = motionCompiler.frames?.(this, el, children, p) ?? this.frames(el, p);
      // Both element and text spellings validate the final ease before omitting it.
      if (keys.length && (keys.at(-1) as unknown[]).length === 3)
        this.finalEases.push({
          key: keys.at(-1) as unknown[],
          pointer: ptr(p, keys.length - 1) + '/2',
        });
      return keys;
    } else if (el.name === 'event') {
      const v = [
        a.has('at') ? this.read(a.get('at')!, 'number', p + '/0') : 0,
        a.get('name')?.value.trim() ?? '',
      ];
      this.mark(p + '/0', v[0], a.get('at')?.valueAt ?? el.at);
      this.mark(p + '/1', v[1], a.get('name')?.valueAt ?? el.at);
      if (a.has('name')) this.read(a.get('name')!, 'name', p + '/1');
      return v;
    } else if (el.name === 'meta') {
      const text = el.children
        .filter((c) => c.kind === 'text')
        .map((c) => c.value)
        .join('');
      try {
        const v: unknown = JSON.parse(text);
        if (!object(v)) throw new Error(VERBOSE ? 'meta must contain a JSON object' : '');
        this.mark(p, v, el.at);
        this.comment(el, v, p);
        return v;
      } catch (e) {
        this.error(
          'bad-attribute',
          p,
          el.children.find((c) => c.kind === 'text')?.at ?? el.at,
          VERBOSE ? (e instanceof Error ? e.message : 'invalid JSON metadata') : '',
        );
      }
    } else if (el.name === 'color') {
      if (a.has('name')) this.read(a.get('name')!, 'name', p);
      const v = a.has('value') ? this.read(a.get('value')!, 'color', p) : '';
      this.map.set(p, a.get('value')?.valueAt ?? el.at);
      return v;
    } else if (el.name === 'pose') {
      for (const attr of a.values()) {
        const key = this.address(attr.name);
        const v = this.read(attr, key.endsWith('.d') ? 'string' : 'value', ptr(p, key));
        if (v !== undefined) this.put(o, key, v, p, attr.valueAt);
      }
    } else {
      this.copy(el, a, o, p, ['name', 'xmlns']);
      if (a.has('name') && el.name !== 'anima' && el.name !== 'component')
        this.read(a.get('name')!, 'name', p);
      if (el.name === 'anima' || el.name === 'component') {
        if (el.name === 'anima' && a.has('name'))
          this.put(o, 'name', a.get('name')!.value, p, a.get('name')!.valueAt);
        this.put(o, 'nodes', [], p, el.at);
        for (const c of children) this.rootChild(c, o, p);
      } else if (['bool', 'number', 'trigger'].includes(el.name))
        this.put(o, 'type', el.name, p, el.at);
      else if (el.name === 'hit') {
        if (Number(a.has('circle')) + Number(a.has('rect')) !== 1)
          this.error(
            a.size ? 'bad-attribute' : 'missing-attribute',
            p,
            el.at,
            VERBOSE ? '<hit> needs exactly one of circle or rect' : '',
          );
      } else if (el.name === 'timeline') {
        this.put(o, 'tracks', {}, p, el.at);
        for (const c of children) {
          if (c.name === 'track') {
            const target = c.attrs.find((x) => x.name === 'target');
            this.addNamed(
              o.tracks as Json,
              this.address(target?.value.trim() ?? ''),
              c,
              p + '/tracks',
              target?.valueAt ?? c.at,
            );
          } else {
            const [events, ep] = this.append(o, 'events', p, c.at);
            events.push(this.build(c, ep));
          }
        }
      } else if (el.name === 'layer') {
        this.put(o, 'states', {}, p, el.at);
        for (const c of children)
          this.addNamed(
            o.states as Json,
            c.attrs.find((x) => x.name === 'name')?.value.trim() ?? '',
            c,
            p + '/states',
            c.attrs.find((x) => x.name === 'name')?.valueAt ?? c.at,
          );
      } else if (el.name === 'state') {
        if (!a.has('play')) this.put(o, 'pose', {}, p, el.at);
        let pose = false;
        let on = false;
        for (const c of children) {
          if (c.name === 'pose') {
            if (pose || on)
              this.error(
                'misplaced-element',
                p + '/pose',
                c.at,
                VERBOSE ? '<pose> may occur once, before any <on>' : '',
              );
            else own(o, 'pose', this.build(c, p + '/pose'));
            pose = true;
          } else {
            on = true;
            const [list, op] = this.append(o, 'on', p, c.at);
            list.push(this.build(c, op));
          }
        }
      }
    }
    if (el.name === 'asset') delete o.name;
    leave?.();
    return o;
  }

  private rootChild(c: Element, o: Json, p: string): void {
    const name = c.attrs.find((a) => a.name === 'name');
    if (
      convertCompiler.rootChild?.(this, c, o, p) ||
      dataCompiler.rootChild?.(this, c, o, p) ||
      eventsCompiler.rootChild?.(this, c, o, p) ||
      bindCompiler.rootChild?.(this, c, o, p) ||
      motionCompiler.rootChild?.(this, c, o, p)
    )
      return;
    if (textCompiler.rootChild?.(this, c, o, p)) return;
    if (c.name === 'ease') {
      this.attrs(c, p);
      this.children(c, p);
      return;
    }
    if (NODES.includes(c.name) || c.name === 'listener') {
      const [list, cp] = this.append(o, c.name === 'listener' ? 'listeners' : 'nodes', p, c.at);
      list.push(this.build(c, cp));
    } else if (
      [
        'color',
        'glyph',
        'asset',
        'component',
        'bool',
        'number',
        'trigger',
        'timeline',
        'layer',
      ].includes(c.name)
    ) {
      const key =
        c.name === 'color'
          ? 'colors'
          : c.name === 'component'
            ? 'components'
            : c.name === 'asset'
              ? 'assets'
              : c.name === 'glyph'
                ? 'glyphs'
                : c.name === 'timeline'
                  ? 'timelines'
                  : c.name === 'layer'
                    ? 'layers'
                    : 'inputs';
      const parent = key === 'layers' ? this.container(o, 'machine', p, c.at) : o;
      const base = key === 'layers' ? p + '/machine' : p;
      const map = this.container(parent, key, base, c.at);
      this.addNamed(map, name?.value.trim() ?? '', c, ptr(base, key), name?.valueAt ?? c.at);
    } else if (Object.hasOwn(o, c.name))
      this.error(
        'misplaced-element',
        ptr(p, c.name),
        c.at,
        VERBOSE ? `<${c.name}> may occur only once` : '',
      );
    else own(o, c.name, this.build(c, ptr(p, c.name)));
  }

  private copyNode(el: Element, attrs: Map<string, Attr>, o: Json, p: string): void {
    this.put(o, 'type', el.name, p, el.at);
    const id = attrs.get('id');
    if (id) this.put(o, 'id', this.read(id, 'name', p + '/id'), p, id.valueAt);
    for (const a of this.nodeAttrs(el.name as NodeType)) {
      const attr = attrs.get(a.attr);
      if (!attr) continue;
      const paint = a.path.length === 2 ? a.path[0] : undefined;
      if (
        paint &&
        a.path[1] !== 'color' &&
        !attrs.has(paint) &&
        !moduleCompiler.hasPaint?.(this, el, paint)
      )
        this.error(
          'paint-attribute',
          ptr(p, paint),
          attr.valueAt,
          VERBOSE ? `"${attr.name}" needs "${paint}"` : '',
          VERBOSE ? `add ${paint}="…"` : '',
        );
      const v = this.read(
        attr,
        a.index !== undefined
          ? 'number'
          : paint && a.path[1] === 'color'
            ? 'color'
            : this.kind(a.shape),
        a.path.reduce(ptr, p),
      );
      if (v === undefined) continue;
      if (a.index !== undefined) {
        if (!Object.hasOwn(o, a.path[0]!)) this.put(o, a.path[0]!, [], p, attr.valueAt);
        (o[a.path[0]!] as unknown[])[a.index] = v;
        this.map.set(ptr(ptr(p, a.path[0]!), a.index), attr.valueAt);
      } else if (paint)
        this.put(
          this.container(o, paint, p, attr.valueAt),
          a.path[1]!,
          v,
          ptr(p, paint),
          attr.valueAt,
        );
      else this.put(o, a.path[0]!, v, p, attr.valueAt);
    }
  }

  // Decode the text while retaining an offset for each decoded character. Entity lengths differ
  // from their decoded lengths; indexing `value` directly into `raw` would misplace later tokens.
  private text(el: Element): { value: string; offsets: number[] } {
    let value = '';
    const offsets: number[] = [];
    for (const t of el.children) {
      if (t.kind !== 'text') continue;
      for (let i = 0; i < t.raw.length;) {
        const m =
          t.raw[i] === '&'
            ? /^&(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);/.exec(t.raw.slice(i))
            : null;
        let s = t.raw[i]!;
        if (m) {
          const entity = m[0].slice(1, -1);
          s =
            entity[0] === '#'
              ? String.fromCodePoint(
                  parseInt(entity.slice(entity[1] === 'x' ? 2 : 1), entity[1] === 'x' ? 16 : 10),
                )
              : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity]!;
        }
        value += s;
        for (let j = 0; j < s.length; j++) offsets.push(t.offsets?.[i] ?? t.at.offset + i);
        i += m ? m[0].length : 1;
      }
    }
    return { value, offsets };
  }
  private frames(el: Element, p: string): unknown[] {
    const { value, offsets } = this.text(el);
    const keys: unknown[][] = [];
    for (const m of value.matchAll(/[^;\r\n]+/g)) {
      const line = m[0];
      const tokens = [...line.matchAll(/"(?:\\.|[^"\\])*"|\S+/g)];
      if (!tokens.length) continue;
      const at = (i: number) => ({
        ...el.at,
        ...(el.at.locate ?? this.xml!.pos)(offsets[m.index + i] ?? el.at.offset),
      });
      const kp = ptr(p, keys.length);
      try {
        if (tokens.length < 2) throw new Error(VERBOSE ? 'expected time value [ease]' : '');
        const time = this.num(tokens[0]![0]);
        const val = motionCompiler.keyValue?.(tokens[1]![0]) ?? this.scalar(tokens[1]![0]);
        const key: unknown[] = [time, val];
        this.map.set(kp, at(tokens[0]!.index));
        this.map.set(kp + '/0', at(tokens[0]!.index));
        this.map.set(kp + '/1', at(tokens[1]!.index));
        if (tokens.length > 2) {
          const start = tokens[2]!.index;
          key.push(this.ease(line.slice(start).trim()));
          this.map.set(kp + '/2', at(start));
        }
        keys.push(key);
      } catch (e) {
        this.error(
          'bad-keyframe',
          kp,
          at(tokens[0]!.index),
          VERBOSE ? (e instanceof Error ? e.message : 'invalid keyframe') : '',
        );
      }
    }
    return keys;
  }

  collectTypes(el: Element, scoped = false): void {
    if (NODES.includes(el.name)) {
      const id = el.attrs.find((a) => a.name === 'id');
      if (id) this.types.set(scoped ? id.value : id.value.trim(), el.name as NodeType);
    }
    for (const c of el.children)
      if (c.kind === 'element' && (scoped || c.name !== 'component')) this.collectTypes(c, scoped);
  }
  collectEases(el: Element, p: string): void {
    const local = new Set<string>();
    for (const c of el.children) {
      if (c.kind !== 'element' || c.name !== 'ease') continue;
      const n = c.attrs.find((a) => a.name === 'name');
      const curve = c.attrs.find((a) => a.name === 'curve');
      if (!n) continue;
      if (local.has(n.value.trim()) || BUILTINS.includes(n.value.trim()))
        this.error(
          'duplicate-name',
          p,
          n.valueAt,
          VERBOSE ? `ease "${n.value}" is already declared or built in` : '',
        );
      else if (curve) this.eases.set(n.value.trim(), curve);
      local.add(n.value.trim());
      this.read(n, 'name', p);
    }
    this.checkEases(local, p);
  }
  checkEases(names: Iterable<string>, p: string): void {
    for (const name of names) {
      if (!this.eases.has(name)) continue;
      const curve = this.resolveEase(name);
      if (typeof parseEase(curve) === 'string' && !this.failed)
        this.error(
          curve.startsWith('spring(') ? 'reserved' : 'bad-attribute',
          p,
          this.eases.get(name)!.valueAt,
          VERBOSE ? (p ? 'invalid ease curve' : `invalid ease curve "${curve}"`) : '',
        );
    }
  }
  run(source: string): CompileResult {
    this.attributes.clear();
    const { doc: xml, errors } = parseXml(source);
    this.xml = xml;
    for (const e of errors) this.error('markup-syntax', '', e.at, VERBOSE ? e.message : '');
    const root = xml.root;
    if (!root) return this.result();
    if (/<(?:import|template|apply)\b/.test(source)) {
      if (libraryCompiler.expand) libraryCompiler.expand(xml, this.opts, this.diagnostics);
      else
        this.diagnostics.push({
          code: 'markup-libraries-unavailable',
          severity: 'error',
          pointer: '',
          message: 'load @anima-format/web/markup-libraries or run anima build',
          hint: 'load @anima-format/web/markup-libraries or run anima build',
          file: this.opts.file,
          line: root.at.line,
          column: root.at.col,
        });
      if (this.failed) return this.result();
    }
    if (root.name !== 'anima') {
      const known = NODES.includes(root.name) || Object.hasOwn(FORMS, root.name);
      this.error(
        known ? 'misplaced-element' : 'unknown-element',
        '',
        root.at,
        VERBOSE ? 'the root element must be <anima>' : '',
        VERBOSE ? suggest(root.name, ['anima']) : '',
      );
      return this.result();
    }
    this.collectTypes(root);
    this.collectEases(root, '');
    const doc = this.build(root, '') as Json;
    componentCompiler.finish?.(doc);
    if (!this.failed && this.opts.validate !== false) {
      for (const d of load(doc).diagnostics) {
        let p = d.pointer;
        while (!this.map.has(p) && p) p = p.slice(0, p.lastIndexOf('/'));
        const at = this.map.get(p) ?? root.at;
        this.diagnostics.push({
          ...d,
          ...(VERBOSE && d.code === 'undeclared-feature'
            ? { hint: `add requires="${d.hint?.split('"')[1]}" to <anima>` }
            : {}),
          ...(d.hint && DECLARE[d.hint] ? { hint: DECLARE[d.hint] } : {}),
          line: at.line,
          column: at.col,
          file: at.file ?? this.opts.file,
          ...(at.related ? { related: [location(at.related)] } : {}),
        });
      }
    }
    if (this.failed) return this.result();
    // Check even unused final eases before dropping them, so a typo or reserved ease is never
    // silently accepted. Their origin stays available when validation fails.
    for (const { key, pointer } of this.finalEases) {
      key.pop();
      this.map.delete(pointer);
    }
    const text = formatAni(doc);
    // Return canonical insertion order as well as canonical text.
    return { ...this.result(), doc: JSON.parse(text) as Json, text };
  }
  result(): CompileResult {
    return { diagnostics: this.diagnostics, map: this.map };
  }
  unexpected(e: unknown): CompileResult {
    // The parser contract says it never throws, but invalid numeric entities currently can. Keep
    // the public compiler total, including on pathological depth/size, without exposing a stack.
    this.error(
      'markup-syntax',
      '',
      { offset: 0, line: 1, col: 1 },
      VERBOSE ? (e instanceof Error ? e.message : 'invalid markup') : '',
    );
    return this.result();
  }
}

// Loader hints that name a .ani container, said the markup way.
const DECLARE: Record<string, string> = VERBOSE
  ? {
      'declare it in "inputs"':
        'declare it: <bool name="…"/>, <number name="…"/> or <trigger name="…"/>',
      'declare it in "colors"': 'declare it: <color name="…" value="#…"/>',
      'declare it in "glyphs"': 'declare it: <glyph name="…" d="…"/>',
    }
  : {};

/** Compile AniML to canonical .ani with a source map. Never throws on malformed source. */
export function compile(source: string, opts: CompileOptions = {}): CompileResult {
  const compiler = new Compiler(opts);
  try {
    return compiler.run(source);
  } catch (e) {
    return compiler.unexpected(e);
  }
}
