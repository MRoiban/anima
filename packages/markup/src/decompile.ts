import { ELEMENTS, markupName, type NodeType } from '@anima-format/core';
import { markupAddress, nodeAttrs } from './names.ts';
import { type LayoutElement, render } from './layout.ts';

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
      ...keys
        .filter((k) => o[k] !== undefined)
        .map((k): [string, string] => [
          k,
          k === 'when'
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
    for (const a of nodeAttrs(n.type as NodeType)) {
      let v: unknown = n;
      for (const key of a.path) v = obj(v)[key];
      if (a.index !== undefined && v !== undefined) v = (v as unknown[])[a.index];
      if (v !== undefined) el.attrs.push([a.attr, value(v)]);
    }
    const structural = (name: string, data: Obj): LayoutElement => {
      const form = ELEMENTS[name]!;
      const child = element(name, data, []);
      for (const [k, s] of Object.entries(form.shape.p)) {
        if (data[k] === undefined) continue;
        if (s.k === 'arr' && s.of.element)
          child.children.push(...(data[k] as Obj[]).map((v) => structural(s.of.element!, v)));
        else child.attrs.push([markupName(s, k), value(data[k])]);
      }
      return child;
    };
    const arrays = new Set<string>();
    for (const [name, form] of Object.entries(ELEMENTS)) {
      if (!form.target) continue;
      for (const key of form.target.choices) {
        if (n[key] === undefined) continue;
        if (form.target.array) {
          if (arrays.has(key)) continue;
          arrays.add(key);
          for (const entry of n[key] as Obj[])
            for (const [childName, childForm] of Object.entries(ELEMENTS)) {
              if (!childForm.target?.array || !childForm.target.choices.includes(key)) continue;
              const data = entry[childForm.target.wrapper!];
              if (data) el.children.push(structural(childName, obj(data)));
            }
          continue;
        }
        const data = obj(n[key]);
        if (!Object.entries(form.values ?? {}).every(([k, v]) => data[k] === v)) continue;
        const child = structural(name, data);
        if (key !== form.target.default) child.attrs.unshift([form.target.attribute, key]);
        el.children.push(child);
      }
    }
    el.children.push(...((n.children ?? []) as Obj[]).map(node));
    return el;
  };
  const root = element(
    'anima',
    d,
    ['name', 'title', 'grid', 'viewBox', 'requires'],
    [['version', value(d.anima)]],
  );
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
        ['type', 'storage', 'width', 'height'],
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
  groups.push(((d.nodes ?? []) as Obj[]).map(node));
  groups.push(
    entries(d.timelines).map(([name, v]) => {
      const t = obj(v);
      const el = element('timeline', t, ['duration', 'loop', 'reducedMotion'], [['name', name]]);
      for (const [target, keys] of entries(t.tracks)) {
        const track = element('track', {}, [], [['target', address(target)]]);
        track.children.push({
          text: (keys as unknown[][])
            .map((k) =>
              k
                .map((v, i) => (i === 1 && target.endsWith('.d') ? JSON.stringify(v) : value(v)))
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
  groups.push(
    entries(obj(d.machine).layers).map(([name, v]) => {
      const l = obj(v);
      const el = element('layer', l, ['initial'], [['name', name]]);
      for (const [name, v] of entries(l.states)) {
        const s = obj(v);
        const state = element('state', s, ['play', 'speed', 'emit'], [['name', name]]);
        if (s.pose !== undefined)
          state.children.push(
            element(
              'pose',
              obj(s.pose),
              [],
              entries(s.pose).map(([k, v]) => [address(k), value(v)]),
            ),
          );
        state.children.push(
          ...((s.on ?? []) as Obj[]).map((on) =>
            element('on', on, ['when', 'to', 'blend', 'ease', 'interruptible']),
          ),
        );
        el.children.push(state);
      }
      return el;
    }),
  );
  groups.push(
    ((d.listeners ?? []) as Obj[]).map((l) =>
      element('listener', l, ['on', 'target', 'hitPadding', 'fire', 'set', 'toggle', 'emit']),
    ),
  );
  for (const group of groups.filter((g) => g.length)) {
    group[0]!.blank = root.children.length > 0;
    root.children.push(...group);
  }
  return render(root) + '\n';
}
