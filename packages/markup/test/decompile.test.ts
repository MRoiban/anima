import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatAni, load, type NodeType } from '@anima-format/core';
import { compile, decompile, formatMarkup, parseXml, type Element } from '../src/index.ts';
import { aniAddress, nodeAttrs, NODE_ELEMENTS } from '../src/names.ts';
import { attrOrder, ATTR_ORDER } from '../src/layout.ts';

const read = (p: string) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const cases = readdirSync(new URL('../../../spec/conformance/', import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const corpus = [
  ['bell', read('examples/bell.ani')],
  ...cases.map((n) => [n, read(`spec/conformance/${n}/case.ani`)]),
];
type Obj = Record<string, unknown>;
const elements = (e: Element) => e.children.filter((c): c is Element => c.kind === 'element');
const attrs = (e: Element) => Object.fromEntries(e.attrs.map((a) => [a.name, a.value]));
const scalar = (s: string): unknown =>
  s.startsWith('"') || s === 'true' || s === 'false' || /^-?\d/.test(s) ? JSON.parse(s) : s;
const vector = (s: string) => s.split(/\s+/).map(Number);

// Independent structural reader for emitted markup: compare every value, not just snapshots.
function recover(root: Element): Obj {
  const types = new Map<string, NodeType>();
  const collect = (e: Element) => {
    if (NODE_ELEMENTS.includes(e.name)) types.set(attrs(e).id!, e.name as NodeType);
    elements(e).forEach(collect);
  };
  collect(root);
  const address = (s: string) => aniAddress(s, (id) => types.get(id)) ?? s;
  const base = (e: Element): Obj => {
    const c = e.children.find((c) => c.kind === 'comment');
    return c?.kind === 'comment' ? { $comment: c.value.trim() } : {};
  };
  const plain = (e: Element): Obj => {
    const o = base(e);
    for (const [k, v] of Object.entries(attrs(e)))
      o[k] = [
        'default',
        'min',
        'max',
        'buffer',
        'duration',
        'speed',
        'blend',
        'interruptible',
        'at',
        'hitPadding',
      ].includes(k)
        ? scalar(v)
        : k === 'when'
          ? v.replace(/\band\b/g, '&&')
          : v;
    return o;
  };
  const node = (e: Element): Obj => {
    const o: Obj = { ...base(e), id: attrs(e).id, type: e.name };
    for (const a of nodeAttrs(e.name as NodeType)) {
      const v = attrs(e)[a.attr];
      if (v === undefined) continue;
      const parent = a.path.length === 2 ? ((o[a.path[0]!] ??= {}) as Obj) : o;
      const key = a.path.at(-1)!;
      if (a.index !== undefined) ((parent[key] ??= []) as unknown[])[a.index] = Number(v);
      else
        parent[key] =
          key === 'dash'
            ? v.split(' ').map((x) => (x.endsWith('%') ? x : Number(x)))
            : ['pivot', 'subpaths', 'corners'].includes(key)
              ? vector(v)
              : scalar(v);
    }
    for (const g of elements(e).filter((c) =>
      ['linearGradient', 'radialGradient'].includes(c.name),
    )) {
      const a = attrs(g);
      const key = a.paint ?? 'fill';
      const target = (o[key] ??= {}) as Obj;
      target.type = g.name === 'linearGradient' ? 'linear' : 'radial';
      for (const [k, v] of Object.entries(a)) if (k !== 'paint') target[k] = Number(v);
      target.stops = elements(g).map((s) => ({
        ...base(s),
        position: Number(attrs(s).offset),
        color: attrs(s)['stop-color'],
      }));
    }
    for (const child of elements(e)) {
      const a = attrs(child);
      if (child.name === 'mask')
        o.mask = {
          ...base(child),
          source: a.source,
          mode: a.mode,
          sourceDraws: a['source-draws'] === 'true',
        };
      if (child.name === 'clip') o.clip = { ...base(child), source: a.source, rule: a.rule };
      if (child.name === 'drawOrder')
        o.drawOrder = {
          ...base(child),
          target: a.target,
          position: a.position,
          ...(a.active === undefined ? {} : { active: a.active === 'true' }),
        };
      if (['fillPaint', 'strokePaint'].includes(child.name)) {
        const kind = child.name === 'fillPaint' ? 'fill' : 'stroke';
        const paint: Obj = { ...base(child) };
        for (const attr of nodeAttrs('rect').filter((v) => v.path[0] === kind))
          if (a[attr.attr] !== undefined) paint[attr.path[1]!] = scalar(a[attr.attr]!);
        ((o.paints ??= []) as unknown[]).push({ [kind]: paint });
      }
    }
    if (e.name === 'group')
      o.children = elements(e)
        .filter((c) => NODE_ELEMENTS.includes(c.name))
        .map(node);
    return o;
  };
  const d: Obj = { ...base(root), ...attrs(root), nodes: [] };
  d.anima = d.version;
  delete d.version;
  d.grid = Number(d.grid);
  if (d.viewBox) d.viewBox = vector(d.viewBox as string);
  if (d.requires) d.requires = (d.requires as string).split(' ');
  const insert = (key: string, name: string, v: unknown) => (((d[key] ??= {}) as Obj)[name] = v);
  for (const el of elements(root)) {
    const a = attrs(el),
      p = plain(el);
    const name = a.name!;
    delete p.name;
    if (el.name === 'bind') insert('bind', address(a.target!), a.value);
    else if (NODE_ELEMENTS.includes(el.name)) (d.nodes as unknown[]).push(node(el));
    else if (el.name === 'meta')
      d.meta = {
        ...base(el),
        ...JSON.parse(
          el.children
            .filter((c) => c.kind === 'text')
            .map((c) => c.value)
            .join(''),
        ),
      };
    else if (el.name === 'color') insert('colors', name, a.value);
    else if (el.name === 'glyph') insert('glyphs', name, p);
    else if (el.name === 'asset') {
      const asset: Obj = { ...p, source: p.src };
      delete asset.src;
      for (const k of ['width', 'height']) if (asset[k] !== undefined) asset[k] = Number(asset[k]);
      insert('assets', name, asset);
    } else if (el.name === 'a11y') d.a11y = p;
    else if (['bool', 'number', 'trigger'].includes(el.name))
      insert('inputs', name, { type: el.name, ...p });
    else if (el.name === 'hit')
      d.hit = {
        ...base(el),
        ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, vector(v)])),
      };
    else if (el.name === 'timeline') {
      const tracks: Obj = {};
      p.tracks = tracks;
      for (const child of elements(el)) {
        if (child.name === 'track')
          tracks[address(attrs(child).target!)] = child.children
            .filter((c) => c.kind === 'text')
            .map((c) => c.value)
            .join('')
            .trim()
            .split('\n')
            .map((line) => {
              const m = /^(\S+)\s+("(?:\\.|[^"\\])*"|\S+)(?:\s+(.*))?$/.exec(line.trim())!;
              return [Number(m[1]), scalar(m[2]!), ...(m[3] ? [m[3]] : [])];
            });
        else ((p.events ??= []) as unknown[]).push([Number(attrs(child).at), attrs(child).name]);
      }
      insert('timelines', name, p);
    } else if (el.name === 'layer') {
      const states: Obj = {};
      p.states = states;
      for (const s of elements(el)) {
        const state = plain(s),
          stateName = state.name as string;
        delete state.name;
        for (const c of elements(s)) {
          if (c.name === 'pose')
            state.pose = {
              ...base(c),
              ...Object.fromEntries(c.attrs.map((a) => [address(a.name), scalar(a.value)])),
            };
          else ((state.on ??= []) as unknown[]).push(plain(c));
        }
        states[stateName] = state;
      }
      const machine = (d.machine ??= {}) as Obj;
      ((machine.layers ??= {}) as Obj)[name] = p;
    } else if (el.name === 'listener') {
      if (a.set)
        p.set = Object.fromEntries(
          a.set.split(' ').map((s) => {
            const [k, v] = s.split('=');
            return [k, scalar(v!)];
          }),
        );
      for (const k of ['fire', 'toggle']) if (a[k]?.includes(' ')) p[k] = a[k]!.split(' ');
      ((d.listeners ??= []) as unknown[]).push(p);
    }
  }
  return d;
}

const rich = {
  anima: '0.1',
  name: 'rich',
  title: 'A < B & "C"',
  grid: 20,
  viewBox: [-2, -2, 24, 24],
  requires: ['knockout'],
  $comment: 'Root comment',
  meta: { author: 'A & B', nested: { yes: true }, $comment: 'Metadata' },
  inputs: {
    level: { type: 'number', default: 0.5, min: 0, max: 1 },
    down: { type: 'bool', default: false },
    ring: { type: 'trigger', buffer: 0.2 },
    other: { type: 'trigger' },
    another: { type: 'bool' },
  },
  hit: { rect: [0, 1, 20, 19], $comment: 'Hit box' },
  nodes: [
    {
      id: 'bar',
      type: 'rect',
      x0: 1,
      y0: 2,
      w: 3,
      h: 4,
      rx: 0.5,
      pivot: [10, 2.5],
      fill: { color: '#fff', rule: 'evenodd' },
      $comment: 'Rectangle',
    },
    {
      id: 'wave',
      type: 'arc',
      center: [10, 10],
      r: 3,
      from: -40,
      to: 40,
      stroke: {
        color: '#000',
        width: 1,
        cap: 'round',
        join: 'round',
        trimStart: 0.1,
        trimEnd: 0.9,
        trimOffset: -0.2,
      },
      knockout: 1,
    },
  ],
  timelines: {
    spin: {
      duration: 1,
      loop: 'loop',
      tracks: {
        'bar.w': [
          [0, 3, 'cubic(0.2, 0, 0.3, 1)'],
          [1, 4],
        ],
      },
      events: [[0.5, 'half']],
    },
    bounce: {
      duration: 1,
      loop: 'pingpong',
      tracks: {
        'wave.stroke.trimEnd': [
          [0, 0],
          [1, 1],
        ],
      },
    },
  },
  machine: {
    layers: {
      main: {
        initial: 'idle',
        $comment: 'Layer',
        states: {
          idle: {
            pose: { 'bar.w': 3, $comment: 'Pose' },
            on: [
              {
                when: 'level < 0.7 && !down',
                to: 'playing',
                blend: 0.2,
                ease: 'inOut',
                interruptible: false,
                $comment: 'Transition',
              },
            ],
          },
          playing: { play: 'spin', speed: 2, emit: 'start' },
        },
      },
    },
  },
  listeners: [
    {
      on: 'click',
      target: 'bar',
      hitPadding: 2,
      fire: ['ring', 'other'],
      set: { down: true, level: 0.2 },
      toggle: ['down', 'another'],
      emit: 'clicked',
      $comment: 'Listener',
    },
  ],
};

function check(source: string | object) {
  const expected = typeof source === 'string' ? JSON.parse(source) : source;
  const text = decompile(source);
  expect(decompile(source)).toBe(text);
  const parsed = parseXml(text);
  expect(parsed.errors).toEqual([]);
  const root = parsed.doc.root!;
  const names = (e: Element) => {
    expect([
      ...Object.keys(ATTR_ORDER),
      ...NODE_ELEMENTS,
      'pose',
      'bind',
      'asset',
      'linearGradient',
      'radialGradient',
      'stop',
      'mask',
      'clip',
      'drawOrder',
      'fillPaint',
      'strokePaint',
    ]).toContain(e.name);
    if (e.name !== 'pose') for (const a of e.attrs) expect(attrOrder(e.name)).toContain(a.name);
    elements(e).forEach(names);
  };
  names(root);
  expect(recover(root)).toEqual(expected);
}

describe('decompile', () => {
  it.each(corpus)('%s preserves every compiled value deterministically', (_name, source) =>
    check(source!),
  );
  it('covers geometry, actions, transitions, events, metadata and comments', () => {
    expect(load(rich).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    check(rich);
  });
  it('places long values on their own continuation line and omits defaults', () => {
    const text = decompile({
      anima: '0.1',
      name: 'long',
      grid: 20,
      nodes: [{ id: 'p', type: 'path', d: 'M0 0' + 'L1 1'.repeat(30) }],
    });
    expect(text).toMatch(/<path id="p"\n {6}d="/);
    expect(text).not.toContain('opacity=');
  });
});

describe('round-trip', () => {
  it.each(corpus)('%s: .ani → AniML → .ani gives the canonical .ani', (_name, source) => {
    const result = compile(decompile(source!));
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.text).toBe(formatAni(JSON.parse(source!)));
  });
  it.each(corpus)('%s: AniML → .ani → AniML → .ani is stable', (_name, source) => {
    const ani1 = compile(decompile(source!)).text!;
    const animl = decompile(ani1);
    const ani2 = compile(animl).text!;
    expect(ani2).toBe(ani1);
    expect(decompile(ani2)).toBe(animl);
  });
  it('examples/bell.animl builds to examples/bell.ani byte for byte, and survives the round trip', () => {
    const built = compile(read('examples/bell.animl'), {
      file: 'examples/bell.animl',
      resolve: read,
    });
    expect(built.diagnostics).toEqual([]);
    expect(built.text).toBe(read('examples/bell.ani'));
    const again = compile(decompile(built.text!)).text;
    expect(again).toBe(built.text);
    expect(
      compile(formatMarkup(read('examples/bell.animl')).text!, {
        file: 'examples/bell.animl',
        resolve: read,
      }).text,
    ).toBe(built.text);
  });
});
