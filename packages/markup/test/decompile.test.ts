import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatAni, load, type NodeType } from '@anima-format/core';
import { compile, decompile, formatMarkup, parseXml, type Element } from '../src/index.ts';
import { pendingReason } from '../../../tools/pending.ts';
import { aniAddress, nodeAttrs, NODE_ELEMENTS } from '../src/names.ts';
import { attrOrder, ATTR_ORDER } from '../src/layout.ts';

const read = (p: string) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');
const cases = readdirSync(new URL('../../../spec/conformance/', import.meta.url), {
  withFileTypes: true,
})
  .filter(
    (entry) =>
      entry.isDirectory() &&
      !pendingReason(new URL('../../../spec/conformance/' + entry.name + '/', import.meta.url)),
  )
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
const recoverStyle = (e: Element): Obj => {
  const o: Obj = {};
  for (const [k, v] of Object.entries(attrs(e))) {
    if (k === 'id') continue;
    o[k === 'line-height' ? 'lineHeight' : k] = [
      'size',
      'weight',
      'tracking',
      'line-height',
    ].includes(k)
      ? Number(v)
      : ['axes', 'features'].includes(k) // seam(P6-13): independent compound-style recovery.
        ? JSON.parse(v)
        : ['fill', 'stroke'].includes(k)
          ? v.startsWith('{')
            ? JSON.parse(v)
            : { color: v }
          : v;
  }
  return o;
};

// Independent structural reader for emitted markup: compare every value, not just snapshots.
function recover(root: Element): Obj {
  const types = new Map<string, NodeType>();
  const collect = (e: Element) => {
    if (NODE_ELEMENTS.includes(e.name)) types.set(attrs(e).id!, e.name as NodeType);
    elements(e)
      .filter((c) => c.name !== 'component')
      .forEach(collect);
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
      o[k === 'export' && e.name === 'instance' ? 'exported' : k] =
        (['entry', 'exit', 'actions', 'guard'].includes(k) && v.startsWith('{')) ||
        (k === 'default' && (v.startsWith('[') || v.startsWith('{')))
          ? JSON.parse(v)
          : [
                'global',
                'exported',
                'export',
                'public',
                'default',
                'min',
                'max',
                'buffer',
                'duration',
                'quantize',
                'exit',
                'exitFraction',
                'speed',
                'blend',
                'interruptible',
                'hold',
                'sync',
                'at',
                'hitPadding',
                'continue',
                'disabled',
                'reset',
                'weight',
                'exitRatio',
                'blendRatio',
                'button',
                'capture',
                'consume',
                'propagate',
                'index',
                'control',
              ].includes(k)
            ? scalar(v)
            : k === 'work'
              ? vector(v)
              : k === 'when'
                ? v.replace(/\band\b/g, '&&')
                : v.startsWith('{"') || v.startsWith('[')
                  ? JSON.parse(v)
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
            : // seam(P7-2): layout spacing is a vector; its uniform corners are scalar.
              ['pivot', 'subpaths', 'geometryOrigin', 'size', 'gap', 'padding', 'margin'].includes(
                  key,
                ) ||
                (key === 'corners' && e.name === 'rect')
              ? vector(v)
              : v.startsWith('{"') || v.startsWith('[')
                ? JSON.parse(v)
                : scalar(v);
    }
    // seam(P6-5): independent recovery of structural effects and ranges.
    const recoverEffect = (el: Element): Obj => {
      const effect: Obj = {};
      for (const [key, value] of Object.entries(attrs(el))) {
        const jsonKey = key.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
        effect[jsonKey] = ['units', 'ease', 'combine', 'run', 'follow-path'].includes(key)
          ? value
          : value.startsWith('{')
            ? JSON.parse(value)
            : Number(value);
      }
      const ranges = elements(el).filter((c) => c.name === 'text-range');
      if (ranges.length) effect.ranges = ranges.map(recoverEffect);
      return effect;
    };
    for (const child of elements(e)) {
      if (child.name === 'text-effect') ((o.effects ??= []) as Obj[]).push(recoverEffect(child));
      if (child.name === 'style')
        ((o.styles ??= {}) as Obj)[attrs(child).id!] = recoverStyle(child);
      if (child.name === 'run') ((o.runs ??= []) as Obj[]).push(attrs(child));
    }
    for (const g of elements(e).filter((c) =>
      ['linearGradient', 'radialGradient', 'angularGradient'].includes(c.name),
    )) {
      const a = attrs(g);
      const key = a.paint ?? 'fill';
      const target = (o[key] ??= {}) as Obj;
      target.type =
        g.name === 'linearGradient'
          ? 'linear'
          : g.name === 'angularGradient'
            ? 'angular'
            : 'radial';
      for (const [k, v] of Object.entries(a))
        if (k !== 'paint') {
          if (k === 'gradient-transform') target.gradientTransform = vector(v);
          else target[k] = Number(v);
        }
      target.stops = elements(g).map((s) => ({
        ...base(s),
        position: Number(attrs(s).offset),
        color: attrs(s)['stop-color'],
      }));
    }
    for (const child of elements(e)) {
      const a = attrs(child);
      // seam(P6-6): independently recover field attribute names and primitive types.
      if (child.name === 'text-input') {
        const field = base(child);
        for (const [key, value] of Object.entries(a)) {
          const jsonKey = key.replace(/-([a-z])/g, (_match, letter: string) =>
            letter.toUpperCase(),
          );
          field[jsonKey] = ['editable', 'multiline', 'obscured', 'selectOnFocus'].includes(jsonKey)
            ? value === 'true'
            : ['maxLength', 'maxLines', 'selectionRadius'].includes(jsonKey)
              ? Number(value)
              : value;
        }
        o.textInput = field;
      }
      if (child.name === 'focus') {
        const focus = base(child);
        for (const [key, value] of Object.entries(a)) {
          const jsonKey =
            key === 'enabled-input' ? 'enabledInput' : key === 'tab-stops' ? 'tabStops' : key;
          focus[jsonKey] = key === 'bounds' ? vector(value) : scalar(value);
        }
        o.focus = focus;
      }
      // seam(P8-9): independently recover the feather extent probe's structural paint.
      if (child.name === 'feather') {
        const feather: Obj = {};
        for (const [key, value] of Object.entries(a))
          if (key !== 'paint')
            feather[key] =
              key === 'offset'
                ? vector(value)
                : key === 'enabled'
                  ? value === 'true'
                  : key === 'space'
                    ? value
                    : Number(value);
        ((o[a.paint ?? 'fill'] ??= {}) as Obj).feather = feather;
      }
      if (child.name === 'a11y') {
        const semantics = base(child);
        for (const [key, value] of Object.entries(a))
          semantics[
            key === 'checked-mixed' ? 'checkedMixed' : key === 'value-text' ? 'valueText' : key
          ] =
            key === 'bounds'
              ? vector(value)
              : [
                    'role',
                    'label',
                    'hint',
                    'value',
                    'value-text',
                    'href',
                    'activate',
                    'live',
                  ].includes(key)
                ? value
                : scalar(value);
        o.a11y = semantics;
      }
      if (child.name === 'channel')
        ((o.channels ??= {}) as Obj)[a.name!] = { type: a.type, value: scalar(a.value!) };
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
    if (e.name === 'instance') {
      const known = new Set(['id', ...nodeAttrs(e.name as NodeType).map((a) => a.attr)]);
      for (const [key, v] of Object.entries(attrs(e)))
        if (!known.has(key)) ((o.inputs ??= {}) as Obj)[key] = scalar(v);
    }
    // seam(P7-2): recover registered layout containers independently of the compiler.
    if (e.name === 'group' || e.name === 'layout')
      o.children = elements(e)
        .filter((c) => NODE_ELEMENTS.includes(c.name))
        .map(node);
    return o;
  };
  const d: Obj = { ...base(root), ...attrs(root), nodes: [] };
  if (typeof d.effects === 'string') d.effects = JSON.parse(d.effects);
  if (typeof d.outputs === 'string') d.outputs = JSON.parse(d.outputs);
  d.anima = d.version;
  delete d.version;
  d.grid = Number(d.grid);
  if (d.machineSeed !== undefined) d.machineSeed = Number(d.machineSeed);
  if (d.viewBox) d.viewBox = vector(d.viewBox as string);
  if (typeof d.data === 'string' && d.data.startsWith('{')) d.data = JSON.parse(d.data);
  if (d['text-styles']) {
    d.textStyles = JSON.parse(String(d['text-styles']));
    delete d['text-styles'];
  }
  if (d.requires) d.requires = (d.requires as string).split(' ');
  const insert = (key: string, name: string, v: unknown) => (((d[key] ??= {}) as Obj)[name] = v);
  for (const el of elements(root)) {
    const a = attrs(el),
      p = ['converter', 'converter-group'].includes(el.name) ? base(el) : plain(el);
    const name = a.name!;
    delete p.name;
    if (el.name === 'converter' || el.name === 'converter-group') {
      const converter = base(el);
      for (const [key, value] of Object.entries(a)) {
        if (key === 'name') continue;
        converter[key] = ['from', 'to'].includes(key)
          ? vector(value)
          : ['chain', 'values'].includes(key)
            ? value.split(/\s+/)
            : ['clamp', 'modulo', 'reverse', 'grouping'].includes(key)
              ? value === 'true'
              : ['decimals', 'length', 'duration'].includes(key) ||
                  (key === 'operand' && !value.startsWith('$'))
                ? Number(value)
                : ['args', 'item'].includes(key)
                  ? JSON.parse(value)
                  : value;
      }
      insert('converters', name, converter);
    } else if (el.name === 'text-style') {
      ((d.textStyles ??= {}) as Obj)[a.id!] = recoverStyle(el);
    } else if (el.name === 'model') {
      const data = (d.data ??= {}) as Obj,
        models = (data.models ??= {}) as Obj,
        properties: Obj = {};
      for (const child of elements(el)) {
        const ca = attrs(child),
          prop = plain(child);
        delete prop.name;
        if (prop.values !== undefined) prop.values = String(prop.values).split(' ');
        if (prop.type !== undefined) {
          prop.assetType = prop.type;
          delete prop.type;
        }
        properties[ca.name!] = { type: child.name, ...prop };
      }
      models[name] = { ...p, properties };
    } else if (el.name === 'enum') {
      const data = (d.data ??= {}) as Obj;
      ((data.enums ??= {}) as Obj)[name] = a.values!.startsWith('[')
        ? JSON.parse(a.values!)
        : a.values!.split(' ');
    } else if (el.name === 'instance' && a.model && !a.id) {
      const data = (d.data ??= {}) as Obj,
        values: Obj = {};
      for (const child of elements(el)) {
        const ca = attrs(child);
        try {
          values[ca.path!] = JSON.parse(ca.value!);
        } catch {
          values[ca.path!] = ca.value;
        }
      }
      ((data.instances ??= {}) as Obj)[name] = { ...p, values };
    } else if (el.name === 'component') {
      const component = recover({ ...el, name: 'anima' });
      delete component.name;
      delete component.anima;
      insert('components', name, component);
    } else if (el.name === 'machine')
      insert(
        'machines',
        name,
        recover({
          ...root,
          children: [
            ...elements(root).filter((c) => NODE_ELEMENTS.includes(c.name)),
            ...elements(el),
          ],
        }).machine,
      );
    else if (el.name === 'bind') {
      const { target, ...spec } = a;
      insert(
        'bind',
        address(target!),
        Object.keys(spec).length === 1
          ? a.value
          : { ...spec, ...(spec.options ? { options: JSON.parse(spec.options) } : {}) },
      );
    } else if (NODE_ELEMENTS.includes(el.name)) (d.nodes as unknown[]).push(node(el));
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
    else if (el.name === 'event-def') {
      const def: Obj = { ...p };
      if (a.payload !== undefined) def.payload = JSON.parse(a.payload);
      if (a.volume !== undefined) def.volume = Number(a.volume);
      insert('eventDefs', name, def);
    } else if (el.name === 'audio-volume') insert('audioVolumes', a.asset!, Number(a.value));
    else if (el.name === 'glyph') insert('glyphs', name, p);
    else if (el.name === 'asset') {
      const asset: Obj = { ...p, source: p.src };
      delete asset.src;
      for (const k of ['width', 'height', 'size', 'duration', 'start', 'end', 'quality'])
        if (asset[k] !== undefined) asset[k] = Number(asset[k]);
      if (asset.export !== undefined) asset.export = asset.export === 'true';
      if (typeof asset.metadata === 'string') asset.metadata = JSON.parse(asset.metadata);
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
      if (a.set !== undefined)
        p.set = Object.fromEntries(
          [
            ...a.set.matchAll(
              /((?:\$[\w-]+:)?\$?[a-z][\w.-]*)=([\s\S]*?)(?=\s+(?:\$[\w-]+:)?\$?[a-z][\w.-]*=|$)/g,
            ),
          ].map((m) => [m[1]!, scalar(m[2]!.trim())]),
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
      'converter',
      'converter-group',
      'asset',
      'linearGradient',
      'radialGradient',
      'angularGradient',
      'stop',
      'mask',
      'clip',
      'drawOrder',
      'fillPaint',
      'strokePaint',
      'feather', // seam(P8-9): painted semantic extent conformance.
      'channel',
      'focus',
      'machine',
      'event-def',
      'audio-volume',
      'model',
      'enum',
      'list',
      'model-ref',
      'asset-ref',
      'string',
      'set',
      'style',
      'run',
      'text-style',
      // seam(P6-5): registry-defined structural text modifiers.
      'text-effect',
      'text-range',
      // seam(P6-6): new registry-owned field child.
      'text-input',
      // seam(P7-5): typed component data property.
      'artboard',
    ]).toContain(e.name);
    if (e.name !== 'pose')
      for (const a of e.attrs) {
        if (e.name === 'instance' && attrs(e).id && !attrOrder(e.name).includes(a.name)) {
          const component = (expected.components as Obj)[attrs(e).component!] as Obj;
          expect(Object.keys(component.inputs as Obj)).toContain(a.name);
        } else if (e.name === 'component' && a.name === 'outputs') {
          expect(JSON.parse(a.value)).toEqual(
            ((expected.components as Obj)[attrs(e).name!] as Obj).outputs,
          );
        } else expect(attrOrder(e.name)).toContain(a.name);
      }
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
