import { elementFields, compoundField } from './fields.ts';
import { motionCompiler, eventsCompiler, dataCompiler, convertCompiler } from './module-hooks.ts';
import { parseXml, type Element } from './xml.ts';
import { ELEMENTS, markupName, type NodeType } from '@anima-format/core';
import { markupAddress, nodeAttrs } from './names.ts';
import { type LayoutElement, type LayoutChild, render } from './layout.ts';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v ?? {}) as Obj;
const entries = (v: unknown) => Object.entries(obj(v)).filter(([k]) => k !== '$comment');
const value = (v: unknown): string =>
  Array.isArray(v) ? v.map(value).join(' ') : typeof v === 'string' ? v : JSON.stringify(v);

/** Canonical AniML for a valid compiled document; no defaults are materialised. */
export function decompile(doc: string | object): string {
  const d = obj(typeof doc === 'string' ? JSON.parse(doc) : doc);
  const types = new Map<string, NodeType>();
  const visit = (nodes: unknown) => {
    for (const v of (nodes ?? []) as Obj[]) {
      types.set(v.id as string, v.type as NodeType);
      visit(v.children);
    }
  };
  visit(d.nodes);
  const address = (s: string) => markupAddress(s, (id) => types.get(id));
  const element = (
    name: string,
    o: Obj,
    keys: string[],
    extra: [string, string][] = [],
  ): LayoutElement => ({
    name,
    attrs: [
      ...extra,
      ...(elementFields(name).length && name !== 'anima'
        ? elementFields(name).map((f) => f.key)
        : keys
      )
        .filter((k) => o[k] !== undefined)
        .map((k): [string, string] => [
          elementFields(name).find((f) => f.key === k)?.attr ?? k,
          compoundField(elementFields(name).find((f) => f.key === k)?.shape ?? { k: 'str' }) &&
          k !== 'set' &&
          !['fire', 'toggle'].includes(k)
            ? JSON.stringify(o[k])
            : k === 'when'
              ? value(o[k]).replace(/&&/g, 'and')
              : k === 'set'
                ? entries(o[k])
                    .map(([n, v]) => `${n}=${value(v)}`)
                    .join(' ')
                : value(o[k]),
        ]),
    ],
    children: typeof o.$comment === 'string' ? [{ comment: ` ${o.$comment} ` }] : [],
  });
  const node = (n: Obj): LayoutElement => {
    const el = element(n.type as string, n, ['id']);
    el.children.push(...(motionCompiler.channels?.(n) ?? []));
    for (const a of nodeAttrs(n.type as NodeType)) {
      if (
        typeof n[a.path[0]!] === 'object' &&
        Object.values(ELEMENTS).some(
          (f) =>
            f.target?.default === a.path[0] &&
            (f.target.mapKey || (f.target.array && !f.target.wrapper)),
        )
      )
        continue;
      let v: unknown = n;
      for (const key of a.path) v = obj(v)[key];
      if (a.index !== undefined && v !== undefined) v = (v as unknown[])[a.index];
      if (v !== undefined)
        el.attrs.push([
          a.attr,
          ['obj', 'map', 'any', 'alt'].includes(a.shape.k) ? JSON.stringify(v) : value(v),
        ]);
    }
    const structural = (name: string, data: Obj): LayoutElement => {
      const form = ELEMENTS[name]!;
      const child = element(name, data, []);
      for (const [k, s] of Object.entries(form.shape.p)) {
        if (data[k] === undefined) continue;
        if (s.k === 'arr' && s.of.element)
          child.children.push(...(data[k] as Obj[]).map((v) => structural(s.of.element!, v)));
        else if (s.k === 'obj' && s.element)
          child.children.push(structural(s.element, obj(data[k])));
        else
          child.attrs.push([
            markupName(s, k),
            ['fill', 'stroke'].includes(k) &&
            s.k === 'obj' &&
            Object.keys(obj(data[k])).length === 1
              ? value(obj(data[k]).color)
              : s.k === 'alt' &&
                  !(s.of.some((v) => v.k === 'bool') && s.of.some((v) => v.k === 'str'))
                ? JSON.stringify(data[k])
                : value(data[k]),
          ]);
      }
      return child;
    };
    const arrays = new Set<string>();
    const rank = (form: (typeof ELEMENTS)[string]) =>
      form.target && (form.target.mapKey || (form.target.array && !form.target.wrapper))
        ? Object.keys(n).indexOf(form.target.default)
        : -1;
    for (const [name, form] of Object.entries(ELEMENTS).sort((a, b) => rank(a[1]) - rank(b[1]))) {
      if (!form.target) continue;
      for (const key of form.target.choices) {
        if (n[key] === undefined) continue;
        if (form.target.array) {
          if (!Array.isArray(n[key])) continue;
          if (arrays.has(key)) continue;
          arrays.add(key);
          for (const entry of n[key] as Obj[])
            for (const [childName, childForm] of Object.entries(ELEMENTS)) {
              if (!childForm.target?.array || !childForm.target.choices.includes(key)) continue;
              const data = entry[childForm.target.wrapper!];
              if (data) el.children.push(structural(childName, obj(data)));
              else if (!childForm.target.wrapper) el.children.push(structural(childName, entry));
            }
          continue;
        }
        if (form.target.mapKey) {
          for (const [id, style] of entries(n[key]))
            el.children.push(structural(name, { ...obj(style), [form.target.mapKey]: id }));
          continue;
        }
        const target = (form.target.path ?? []).reduce<unknown>((v, part) => obj(v)[part], n[key]);
        if (target === undefined) continue;
        const data = obj(target);
        if (!Object.entries(form.values ?? {}).every(([k, v]) => data[k] === v)) continue;
        const child = structural(name, data);
        if (key !== form.target.default) child.attrs.unshift([form.target.attribute, key]);
        el.children.push(child);
      }
    }
    if (n.type === 'instance')
      el.attrs.push(...entries(n.inputs).map(([key, v]): [string, string] => [key, value(v)]));
    el.children.push(...((n.children ?? []) as Obj[]).map(node));
    return el;
  };
  const root = element(
    'anima',
    d,
    ['name', 'title', 'grid', 'viewBox', 'requires'],
    [['version', value(d.anima)], ...(dataCompiler.rootAttrs?.(d) ?? [])],
  );
  for (const f of elementFields('anima'))
    if (d[f.key] !== undefined && !Object.values(ELEMENTS).some((form) => form.root === f.key))
      root.attrs.push([
        f.attr,
        ['obj', 'map', 'arr', 'alt'].includes(f.shape.k)
          ? JSON.stringify(d[f.key])
          : value(d[f.key]),
      ]);
  const groups: LayoutElement[][] = [];
  if (d.meta !== undefined) {
    const meta = element('meta', obj(d.meta), []);
    const data = { ...obj(d.meta) };
    delete data.$comment;
    meta.children.push({ text: JSON.stringify(data) });
    groups.push([meta]);
  }
  groups.push(
    entries(d.colors).map(([name, v]) =>
      element(
        'color',
        {},
        [],
        [
          ['name', name],
          ['value', value(v)],
        ],
      ),
    ),
  );
  groups.push(
    entries(d.glyphs).map(([name, v]) =>
      element('glyph', obj(v), ['d', 'source', 'pick', 'sha256'], [['name', name]]),
    ),
  );
  groups.push(
    entries(d.assets).map(([name, v]) => {
      const a = obj(v);
      return element(
        'asset',
        a,
        Object.keys(ELEMENTS.asset!.shape.p).filter((k) => !['name', 'source'].includes(k)),
        [
          ['name', name],
          ['src', value(a.source)],
        ],
      );
    }),
  );
  groups.push(
    d.a11y ? [element('a11y', obj(d.a11y), ['role', 'label', 'activate', 'pressed', 'held'])] : [],
  );
  groups.push(
    entries(d.inputs).map(([name, v]) =>
      element(obj(v).type as string, obj(v), ['default', 'min', 'max', 'buffer'], [['name', name]]),
    ),
  );
  groups.push(d.hit ? [element('hit', obj(d.hit), ['circle', 'rect'])] : []);
  groups.push(
    entries(d.components).map(([name, component]) => {
      // Reuse document decompilation so local node addresses retain their own type scope.
      const nested = obj(component);
      const xml = decompile({ anima: '0.1', name: 'component', ...nested });
      const parsed = parseXml(xml).doc.root!;
      const convert = (el: Element): LayoutElement => ({
        name: el.name,
        attrs: el.attrs
          .filter((a) => el !== parsed || !['version', 'name', 'requires'].includes(a.name))
          .map((a) => [a.name, a.value]),
        children: el.children.flatMap<LayoutChild>((c) =>
          c.kind === 'element'
            ? [convert(c)]
            : c.kind === 'text' && c.value.trim()
              ? [{ text: c.value.trim() }]
              : [],
        ),
      });
      const el = convert(parsed);
      el.name = 'component';
      el.attrs.unshift(['name', name]);
      return el;
    }),
  );
  for (const [name, form] of Object.entries(ELEMENTS))
    if (form.root && form.mapKey)
      groups.push(
        entries(d[form.root]).map(([id, style]) => {
          const o = { ...obj(style), [form.mapKey!]: id };
          return element(
            name,
            o,
            Object.keys(o).map((k) => k),
          );
        }),
      );
  groups.push(((d.nodes ?? []) as Obj[]).map(node));
  groups.push(
    entries(d.timelines).map(([name, v]) => {
      const t = obj(v);
      const el = element('timeline', t, [], [['name', name]]);
      for (const [target, keys] of entries(t.tracks)) {
        const track = element('track', {}, [], [['target', address(target)]]);
        track.children.push({
          text: (keys as unknown[][])
            .map((k) =>
              k
                .map((v, i) => (i === 1 && typeof v === 'string' ? JSON.stringify(v) : value(v)))
                .join(' '),
            )
            .join('\n'),
        });
        el.children.push(track);
      }
      el.children.push(
        ...((t.events ?? []) as [number, string][]).map(([at, name]) =>
          element('event', { at, name }, ['at', 'name']),
        ),
      );
      return el;
    }),
  );
  const machineLayers = (machine: unknown): LayoutElement[] =>
    entries(obj(machine).layers).map(([name, v]) => {
      const l = obj(v);
      const el = element('layer', l, [], [['name', name]]);
      for (const [name, v] of entries(l.states)) {
        const s = obj(v);
        const state = element('state', s, [], [['name', name]]);
        if (s.pose !== undefined)
          state.children.push(
            element(
              'pose',
              obj(s.pose),
              [],
              entries(s.pose).map(([k, v]) => [
                address(k),
                typeof v === 'string' && !k.endsWith('.d') ? JSON.stringify(v) : value(v),
              ]),
            ),
          );
        state.children.push(...((s.on ?? []) as Obj[]).map((on) => element('on', on, [])));
        el.children.push(state);
      }
      return el;
    });
  groups.push(eventsCompiler.definitions?.(d) ?? []);
  groups.push(dataCompiler.definitions?.(d) ?? []);
  groups.push(convertCompiler.definitions?.(d) ?? []);
  groups.push(machineLayers(d.machine));
  groups.push(
    entries(d.machines).map(([name, machine]) => ({
      name: 'machine',
      attrs: [['name', name]],
      children: machineLayers(machine),
    })),
  );
  groups.push(((d.listeners ?? []) as Obj[]).map((l) => element('listener', l, [])));
  groups.push(
    entries(d.bind).map(([target, v]) =>
      element(
        'bind',
        {},
        [],
        [
          ['target', address(target)],
          ...Object.entries(typeof v === 'string' ? { value: v } : (v as Obj)).map(
            ([k, v]): [string, string] => [k, k === 'options' ? JSON.stringify(v) : String(v)],
          ),
        ],
      ),
    ),
  );
  for (const group of groups.filter((g) => g.length)) {
    group[0]!.blank = root.children.length > 0;
    root.children.push(...group);
  }
  return render(root) + '\n';
}
