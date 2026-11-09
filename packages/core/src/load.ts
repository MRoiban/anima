// Loader: parse → structural check → resolve and validate → Model (spec §2 "Strictness").
// Never partially loads: either a Model with no errors, or the diagnostics.

import { drawTree, type DrawTree } from './draw.ts';
import { checkDoc } from './check.ts';
import { type RGBA, parseHex } from './color.ts';
import { type Term, parseCondition, literalCondition } from './cond.ts';
import { type Diagnostic, Diags, ptr, suggest } from './diag.ts';
import { VERBOSE as V } from './flags.ts';
import { type EaseFn, hold, linear, parseEase } from './ease.ts';
import { PathError, type Subpath, parsePath, selectSubpaths } from './path.ts';
import {
  COMMON,
  NAME,
  type NodeType,
  OWN,
  PAINT,
  PAINTED,
  type Prop,
  STATIC,
  nodeShape,
  type ObjShape,
} from './registry.ts';

export const FORMAT_VERSION = '0.1';
export { FEATURES } from './modules.ts';
import { FEATURES, modules } from './modules.ts';

export type Value = number | boolean | RGBA | string;
type Json = Record<string, unknown>;

/* eslint-disable @typescript-eslint/no-explicit-any -- raw JSON after the structural check */
type Raw = any;

export interface NodeM {
  id: string;
  type: NodeType;
  raw: Raw;
  parent: number;
  children: number[];
  /** Path nodes: the selected subpaths, and the path data to draw. */
  geom?: Subpath[];
  d?: string;
}

/** An animatable property of one node. */
export interface Addr {
  node: number;
  /** `rotate`, `fill.color`, `stroke.width`, … */
  key: string;
  prop: Prop;
  rest: Value;
}

export type KeyValue = Value | ((player: import('./player.ts').Player) => Value);

export interface TrackM {
  addr: string;
  times: number[];
  values: KeyValue[];
  eases: EaseFn[];
  sample?: (time: number, player?: import('./player.ts').Player) => Value;
}

export interface TimelineM {
  name: string;
  duration: number;
  loop: 'once' | 'loop' | 'pingpong';
  reduced: 'play' | 'end' | 'skip';
  tracks: TrackM[];
  /** Sorted by time. */
  events: [number, string][];
}

export interface TransitionM {
  actions?: ActionM;
  to: number;
  terms: Term[];
  triggers: string[];
  blend: number;
  ease: EaseFn;
  /** false: the layer takes no transitions while this crossfade runs. */
  interruptible: boolean;
}

export interface StateM {
  name: string;
  entry?: ActionM;
  exit?: ActionM;
  pose?: Map<string, Value>;
  play?: number;
  speed: number;
  emit?: string;
  on: TransitionM[];
  /** Addresses this state writes, S(state) in spec §7. */
  writes: string[];
}

export interface LayerM {
  name: string;
  initial: number;
  states: StateM[];
}

export interface InputM {
  name: string;
  type: 'bool' | 'number' | 'trigger' | 'string' | 'color';
  def: Value;
  readonly?: boolean;
  accepts?: (value: Value) => boolean;
  min: number;
  max: number;
  buffer: number;
}

export type InputEvaluator = (scope: ReadonlyMap<string, Value>) => Value;
export interface ActionM {
  fire: string[];
  set: [string, Value | InputEvaluator][];
  toggle: string[];
  emit?: string;
}
export interface ListenerM extends ActionM {
  on: string;
  /** Node index, or -1 for the whole icon. */
  target: number;
  pad: number;
}

export interface PlaybackPolicy {
  /** Canonical model transition for modules observing player-local policy copies. */
  transition?(transition: TransitionM): TransitionM;
  readonly busy: boolean;
  states(): Record<string, string>;
  inspect(): import('./player.ts').LayerInspect[];
  resume(run: object, time: number): void;
  reduce(
    t: TimelineM,
    speed: number,
    end: boolean,
    layer: string,
    events: import('./player.ts').AnimaEvent[],
  ): number;
  enter(
    run: object,
    from: StateM | undefined,
    to: StateM,
    transition: TransitionM | undefined,
    carry: number,
  ): void;
  prepare(
    run: object,
    state: StateM,
    dt: number,
    eligible: (transition: TransitionM) => boolean,
  ): void;
  rest(run: object, state: StateM): boolean;
  local(timeline: TimelineM, elapsed: number, speed: number, run: object): number;
  duration(timeline: TimelineM, speed: number, run: object): number;
  finished(timeline: TimelineM, elapsed: number, run: object): boolean;
  events(
    timeline: TimelineM,
    a: number,
    b: number,
    closed: boolean,
    layer: string,
    out: import('./player.ts').AnimaEvent[],
    speed: number,
    run: object,
    source?: [number, string][],
  ): void;
  gate(transition: TransitionM, state: StateM, elapsed: number, run: object): boolean;
  carry(transition: TransitionM, state: StateM, elapsed: number, run: object): number | undefined;
  pivot(player: import('./player.ts').Player, node: number): [number, number];
  compose(dt: number, values: Value[], events: import('./player.ts').AnimaEvent[]): boolean;
}
export interface Model {
  /** Optional module-owned, typed literal functions in direct equality guards. */
  guardLiterals?: Record<string, (argument: string, path: string) => Value | undefined>;
  /** Compile a player-local key value without rewriting the authored track. */
  keyValue?: (addr: Addr, raw: unknown, pointer: string, d: Diags) => KeyValue | undefined;
  /** Optional typed guard compilation; installed by data without growing bind. */
  guard?: (term: Extract<Term, { k: 'expr' }>, pointer: string, d: Diags) => boolean | undefined;

  /** Resolve computed inputs after queued writes, before clocks and machine guards. */
  prepareInputs?: (
    player: import('./player.ts').Player,
    scope: Map<string, Value>,
    dt: number,
  ) => void;
  /** Optional typed data scope and post-state binding pass. */
  afterStep?: (player: import('./player.ts').Player) => void;
  signal?: (player: import('./player.ts').Player, name: string) => void;
  bindData?: (
    parent: import('./player.ts').Player,
    child: import('./player.ts').Player,
    node: NodeM,
  ) => void;
  inputScope?: (player: import('./player.ts').Player) => Map<string, Value>;
  resolveBindings?: (
    player: import('./player.ts').Player,
    values: Value[],
    scope: Map<string, Value>,
    dt: number,
  ) => void;
  /** Module-declared event names exposed by nested players. */
  eventNames?: ReadonlySet<string>;
  timelineMarkers?: (timeline: TimelineM) => [number, string][] | undefined;
  /** Optional event-module reporting, before child events bubble. */
  reportEvents?: (
    player: import('./player.ts').Player,
    events: import('./player.ts').AnimaEvent[],
  ) => void;
  eventSignal?: (
    events: import('./player.ts').AnimaEvent[],
    kind: string,
    layer: string,
    state: string,
    player: import('./player.ts').Player,
    transition?: TransitionM,
  ) => void;
  /** Optional bind-module expressions controlling motion state clocks. */
  timeBindings?: Map<StateM, (scope: ReadonlyMap<string, Value>) => number>;
  playback?: (player: import('./player.ts').Player) => PlaybackPolicy;
  // seam(P7-2): a module initializer may initialize state without adding nested players.
  nesting?: (
    player: import('./player.ts').Player,
  ) => import('./player.ts').PlayerExtension | undefined;
  /** Optional post-state bindings; evaluators receive the current named inputs. */
  bindings?: Map<string, (scope: ReadonlyMap<string, Value>) => Value>;
  /** Built after successful validation; stable for the document lifetime. */
  draw?: DrawTree;
  drawModules?: import('./modules.ts').Module[];
  doc: Raw;
  grid: number;
  viewBox: [number, number, number, number];
  colors: Record<string, string>;
  nodes: NodeM[];
  ids: Map<string, number>;
  /** Every animated address, in a stable order. */
  addrs: Map<string, Addr>;
  timelines: TimelineM[];
  layers: LayerM[];
  inputs: Map<string, InputM>;
  listeners: ListenerM[];
}

/** Optional bind evaluator: keeps expression parsing out of the base runtime. */
export function inputExpression(
  model: Model,
  source: string,
  expected: string,
  pointer: string,
  d: Diags,
  read?: (name: string) => void,
): InputEvaluator | undefined {
  if (!model.doc.requires?.includes('bind')) {
    d.err(
      'undeclared-feature',
      pointer,
      V && 'input expressions require bind',
      V && 'add "bind" to "requires"',
    );
    return;
  }
  return modules
    .get('bind')
    ?.expression?.(
      source,
      new Map([...model.inputs].map(([n, i]) => [n, i.type])),
      expected,
      pointer,
      d,
      read,
    );
}

export interface LoadResult {
  model?: Model;
  diagnostics: Diagnostic[];
}

const LIMITS = { text: 1 << 20, depth: 32, nodes: 2048, keys: 20000, layers: 64, states: 256 };

const asList = (v: unknown): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v as string];

/** Entries of an optional map, without its `$comment`. */
const entries = <T = Raw>(o: Record<string, T> | undefined): [string, T][] =>
  Object.entries(o ?? {}).filter(([k]) => k !== '$comment');

/** Load a document from text or an already-parsed value. */
export function load(input: string | object): LoadResult {
  const d = new Diags();
  if (typeof input !== 'string') return loadDocument(input, d);
  // UTF-8 bytes (SPEC §2: 1 MiB of text): at least one and at most three per UTF-16 unit.
  let bytes = input.length > LIMITS.text ? input.length : 0;
  if (!bytes && input.length * 3 > LIMITS.text)
    for (const ch of input) {
      const c = ch.codePointAt(0)!;
      bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }
  if (bytes > LIMITS.text) {
    d.err('limit-exceeded', '', V && `document is larger than ${LIMITS.text} bytes`);
    return { diagnostics: d.list };
  }
  let doc: unknown;
  try {
    doc = JSON.parse(input);
  } catch (e) {
    d.err('json-syntax', '', V && (e instanceof SyntaxError ? e.message : 'not JSON'));
    return { diagnostics: d.list };
  }
  return loadDocument(doc, d);
}

/** Both input forms share structural/semantic validation and module compilation. */
function loadDocument(doc: unknown, d: Diags): LoadResult {
  const model = parse(doc, d);
  if (model) for (const m of modules.values()) m.load?.(model, model.doc, d);
  if (model && !d.failed) {
    drawTree(model);
    return { model, diagnostics: d.list };
  }
  return { diagnostics: d.list };
}

/** Validate and compile a parsed JSON value; stops at the first failing step. */
function parse(doc: unknown, d: Diags): Model | undefined {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc))
    return d.err('type', '', V && 'a document is a JSON object');
  const v = (doc as Json).anima;
  if (v !== FORMAT_VERSION)
    return v === undefined
      ? d.err('missing-key', '', V && 'missing "anima"', V && `add "anima": "${FORMAT_VERSION}"`)
      : d.err(
          'version-unsupported',
          '/anima',
          V && `format version ${JSON.stringify(v)} is not supported`,
          V && `this runtime reads "${FORMAT_VERSION}"`,
        );
  const requires = (doc as Json).requires;
  if (Array.isArray(requires))
    requires.forEach((f, i) => {
      if (typeof f === 'string' && !FEATURES.includes(f))
        d.err(
          'unknown-feature',
          '/requires/' + i,
          V && `this runtime does not support "${f}"`,
          V && `import '@anima-format/web/${f}' before loading this document`,
        );
    });
  if (d.failed) return;
  try {
    if (checkDoc(doc, d)) return resolve(doc as Raw, d);
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    d.err('limit-exceeded', '', V && 'document is too deeply nested');
  }
}

function resolve(doc: Raw, d: Diags): Model {
  if (/-\d+$/.test(doc.name))
    d.err(
      'bad-name',
      '/name',
      V && `"${doc.name}" ends in -<digits>`,
      V && 'Glyphy reserves that suffix for variants',
    );

  // Colours
  const colors: Record<string, string> = Object.fromEntries(entries<string>(doc.colors));
  for (const [k, c] of Object.entries(colors))
    if (c !== 'currentColor' && !parseHex(c))
      d.err(
        'bad-color',
        ptr('/colors', k),
        V && `"${c}" is not a colour`,
        V && 'use #rgb, #rrggbb, #rrggbbaa or currentColor',
      );
  const checkPaint = (c: string, p: string) => {
    if (c === 'currentColor' || parseHex(c) || Object.hasOwn(colors, c)) return;
    if (NAME.test(c))
      d.err(
        'unknown-color-slot',
        p,
        V && `no colour slot "${c}"`,
        V && (suggest(c, Object.keys(colors)) ?? 'declare it in "colors"'),
      );
    else
      d.err(
        'bad-color',
        p,
        V && `"${c}" is not a colour`,
        V && 'use #rgb, #rrggbb, #rrggbbaa, currentColor or a slot name',
      );
  };

  // Glyphs
  const glyphs: Glyphs = new Map();
  for (const [k, g] of entries(doc.glyphs)) {
    const sp = pathOrError(g.d, ptr('/glyphs', k) + '/d', d);
    glyphs.set(k, sp && { d: g.d, sp }); // undefined: it has a bad-path error
  }

  // Nodes, flattened in paint order
  const nodes: NodeM[] = [];
  const ids = new Map<string, number>();
  const walk = (list: Raw[], parent: number, base: string, depth: number) => {
    list.forEach((raw, i) => {
      const p = base + '/' + i;
      if (depth > LIMITS.depth)
        return d.err('limit-exceeded', p, V && `nodes nest deeper than ${LIMITS.depth}`);
      if (nodes.length >= LIMITS.nodes)
        return d.err('limit-exceeded', p, V && `more than ${LIMITS.nodes} nodes`);
      if (ids.has(raw.id)) d.err('duplicate-id', p + '/id', V && `id "${raw.id}" is used twice`);
      const n: NodeM = { id: raw.id, type: raw.type, raw, parent, children: [] };
      const idx = nodes.push(n) - 1;
      ids.set(raw.id, idx);
      if (parent >= 0) nodes[parent]!.children.push(idx);
      checkNode(n, p, d, glyphs, checkPaint);
      if (raw.children) walk(raw.children, idx, p + '/children', depth + 1);
    });
  };
  walk(doc.nodes, -1, '/nodes', 1);

  if (doc.hit && Object.keys(doc.hit).filter((k) => k !== '$comment').length !== 1)
    d.err('bad-value', '/hit', V && 'hit needs exactly one of "circle" or "rect"');

  // Inputs
  const inputs = new Map<string, InputM>();
  for (const [name, r] of entries(doc.inputs)) {
    const p = ptr('/inputs', name);
    const t = r.type;
    const wrong = (k: string) =>
      d.err('unknown-key', p + '/' + k, V && `${t} inputs take no "${k}"`);
    if (t !== 'number') for (const k of ['min', 'max']) if (k in r) wrong(k);
    if (t !== 'trigger' && 'buffer' in r) wrong('buffer');
    if (t === 'trigger' && 'default' in r) wrong('default');
    const min = r.min ?? -Infinity;
    const max = r.max ?? Infinity;
    if (min > max) d.err('bad-value', p + '/max', V && 'max is less than min');
    const def = r.default ?? (t === 'number' ? 0 : false);
    if (t !== 'trigger' && typeof def !== (t === 'bool' ? 'boolean' : 'number'))
      d.err(
        'value-type',
        p + '/default',
        V && `a ${t} input needs a ${t === 'bool' ? 'boolean' : 'number'} default`,
      );
    else if (t === 'number' && (def < min || def > max))
      d.err('bad-value', p + '/default', V && 'default lies outside [min, max]');
    inputs.set(name, { name, type: t, def, min, max, buffer: r.buffer ?? 0 });
  }
  // Input-use tracking only feeds the verbose unused-input warning.
  const used = V ? new Set<string>() : undefined;
  const needInput = (
    name: string,
    p: string,
    types: InputM['type'][],
    what: string | false,
  ): InputM | undefined => {
    used?.add(name);
    const inp = inputs.get(name);
    if (!inp)
      d.err(
        'unknown-input',
        p,
        V && `no input "${name}"`,
        V && (suggest(name, inputs.keys()) ?? 'declare it in "inputs"'),
      );
    else if (!types.includes(inp.type))
      d.err(
        'input-type',
        p,
        V && `${what} needs a ${types.join(' or ')} input; "${name}" is ${inp.type}`,
        V &&
          (inp.type === 'trigger'
            ? 'use fire for a trigger'
            : 'use an action matching the input type'),
      );
    return inp;
  };

  const model: Model = {
    doc,
    grid: doc.grid,
    viewBox: doc.viewBox ?? [0, 0, doc.grid, doc.grid],
    colors,
    nodes,
    ids,
    inputs,
    addrs: new Map(),
    timelines: [],
    layers: [],
    listeners: [],
  };
  for (const m of modules.values()) m.prepare?.(model, d);
  for (const m of modules.values()) m.resolve?.(model, d);

  // Addresses
  const addrs = new Map<string, Addr>();
  let keyCount = 0;
  const address = (a: string, p: string): Addr | undefined => {
    const r = resolveAddress(a, nodes, ids);
    if (Array.isArray(r)) return void d.err(r[0], p, r[1], r[2]);
    if (r.prop.feature && !doc.requires?.includes(r.prop.feature))
      d.err(
        'undeclared-feature',
        p,
        V && `requires does not declare ${r.prop.feature}`,
        V && `add "${r.prop.feature}" to "requires"`,
      );
    if (r.prop.type === 'color' && !Array.isArray(r.rest)) {
      d.err(
        'color-slot-animated',
        p,
        V && `"${a}" is animated, so its colour must be a hex literal, not "${r.rest}"`,
        V && 'slots are not animatable in 0.1',
      );
      return undefined;
    }
    if (!addrs.has(a)) addrs.set(a, r);
    return r;
  };
  const value = (a: Addr, v: unknown, p: string): Value | undefined => {
    const t = a.prop.type;
    if (t !== 'number' && t !== 'bool' && t !== 'color')
      return modules.get(a.prop.feature!)?.value?.(a, v, p, d);
    if (t === 'color') {
      if (typeof v !== 'string')
        return void d.err('value-type', p, V && `expected a colour string, got ${typeof v}`);
      const c = parseHex(v);
      if (!c) {
        if (v === 'currentColor' || Object.hasOwn(colors, v))
          d.err('color-slot-animated', p, V && `animated colours must be hex literals, not "${v}"`);
        else d.err('bad-color', p, V && `"${v}" is not a colour`);
      }
      return c ?? undefined;
    }
    if (typeof v !== (t === 'bool' ? 'boolean' : 'number'))
      return void d.err(
        'value-type',
        p,
        V && `"${a.key}" takes a ${t === 'bool' ? 'boolean' : 'number'}, got ${typeof v}`,
      );
    return v as Value;
  };
  const ease = (src: string | undefined, p: string): EaseFn => {
    if (src === undefined) return linear;
    if (/^spring\(/.test(src))
      return (d.err('reserved', p, V && 'spring eases arrive in a later anima version'), linear);
    for (const m of modules.values()) {
      const e = m.ease?.(src, p, d);
      if (e) return e;
    }
    const e = parseEase(src);
    if (typeof e === 'string')
      return (
        d.err(
          'bad-ease',
          p,
          V && `"${src}": ${e}`,
          V && 'linear, hold, in, out, inOut, cubic(x1, y1, x2, y2) or elastic(a, p)',
        ),
        linear
      );
    return e;
  };

  // Timelines
  const timelines: TimelineM[] = [];
  const tlIndex = new Map<string, number>();
  for (const [name, r] of entries(doc.timelines)) {
    const p = ptr('/timelines', name);
    const tl: TimelineM = {
      name,
      duration: r.duration,
      loop: r.loop ?? 'once',
      reduced: r.reducedMotion ?? 'end',
      tracks: [],
      events: [],
    };
    for (const [a, keys] of entries<Raw[]>(r.tracks)) {
      const tp = ptr(p + '/tracks', a);
      const ad = address(a, tp);
      if (!keys.length) {
        d.err('empty-track', tp, V && `track "${a}" has no keyframes`);
        continue;
      }
      if ((keyCount += keys.length) > LIMITS.keys)
        d.err('limit-exceeded', tp, V && `more than ${LIMITS.keys} keyframes`);
      const tr: TrackM = { addr: a, times: [], values: [], eases: [] };
      keys.forEach((k, i) => {
        const kp = tp + '/' + i;
        const [t, val, e] = k;
        if (t < 0 || t > tl.duration)
          d.err('key-range', kp + '/0', V && `time ${t} lies outside [0, ${tl.duration}]`);
        if (i && t <= tr.times[i - 1]!)
          d.err(
            'key-order',
            kp + '/0',
            V && `time ${t} does not come after ${tr.times[i - 1]}`,
            V && 'keyframe times must strictly increase',
          );
        const ef = ease(e, kp + '/2');
        if (ad?.prop.type === 'bool' && e !== undefined && ef !== hold)
          d.err('bad-ease', kp + '/2', V && 'boolean keys only take "hold"');
        tr.times.push(t);
        tr.values.push(
          ad ? (model.keyValue?.(ad, val, kp + '/1', d) ?? value(ad, val, kp + '/1') ?? 0) : 0,
        );
        tr.eases.push(ef);
      });
      if (ad) {
        for (const m of modules.values()) m.track?.(tr, ad, keys, tp, d);
        tl.tracks.push(tr);
      }
    }
    (r.events ?? []).forEach((ev: [number, string], i: number) => {
      if (ev[0] < 0 || ev[0] > tl.duration)
        d.err(
          'key-range',
          `${p}/events/${i}/0`,
          V && `time ${ev[0]} lies outside [0, ${tl.duration}]`,
        );
      tl.events.push([ev[0], ev[1]]);
    });
    tl.events.sort((a, b) => a[0] - b[0]);
    tlIndex.set(name, timelines.push(tl) - 1);
  }

  // Machine
  const action = (r: Raw, p: string): ActionM => {
    const fire = asList(r.fire);
    const toggle = asList(r.toggle);
    fire.forEach((n) => needInput(n, p + '/fire', ['trigger'], V && '"fire"'));
    toggle.forEach((n) => needInput(n, p + '/toggle', ['bool'], V && '"toggle"'));
    const set: ActionM['set'] = [];
    for (const [n, val] of entries<number | boolean | string>(r.set)) {
      const sp = ptr(p + '/set', n);
      const inp = needInput(n, sp, ['bool', 'number', 'string', 'color'], V && '"set"');
      if (inp?.readonly)
        d.err('data-readonly', sp, V && 'path is read-only', V && 'write an item property instead');
      if (typeof val === 'string' && inp && inp.type !== 'trigger') {
        const e = inputExpression(model, val, inp.type, sp, d, (n) => used?.add(n));
        if (e) set.push([n, e]);
        continue;
      }
      if (
        inp &&
        inp.type !== 'trigger' &&
        !(inp.accepts?.(val) ?? typeof val === (inp.type === 'bool' ? 'boolean' : 'number'))
      )
        d.err(
          'input-type',
          sp,
          V && `"${n}" is ${inp.type}; it cannot be set to ${JSON.stringify(val)}`,
        );
      if (typeof val !== 'string') set.push([n, val]);
    }
    return { fire, set, toggle, emit: r.emit };
  };

  const layers: LayerM[] = [];
  const layerEntries = entries(doc.machine?.layers);
  if (layerEntries.length > LIMITS.layers)
    d.err('limit-exceeded', '/machine/layers', V && `more than ${LIMITS.layers} layers`);
  for (const [lname, lr] of layerEntries) {
    const lp = ptr('/machine/layers', lname);
    const names = entries(lr.states).map((e) => e[0]);
    if (names.length > LIMITS.states)
      d.err('limit-exceeded', lp + '/states', V && `more than ${LIMITS.states} states`);
    const stateIdx = (n: string, p: string) => {
      const i = names.indexOf(n);
      if (i < 0)
        d.err(
          'unknown-state',
          p,
          V && `no state "${n}" in layer "${lname}"`,
          V && suggest(n, names),
        );
      return i;
    };
    const layer: LayerM = {
      name: lname,
      initial: stateIdx(lr.initial, lp + '/initial'),
      states: [],
    };
    names.forEach((sname, si) => {
      const sr = lr.states[sname];
      const sp = ptr(lp + '/states', sname);
      const st: StateM = { name: sname, speed: sr.speed ?? 1, emit: sr.emit, on: [], writes: [] };
      if (sr.entry) st.entry = action(sr.entry, sp + '/entry');
      if (sr.exit) st.exit = action(sr.exit, sp + '/exit');
      if (st.speed <= 0 && !doc.requires?.includes('motion'))
        d.err(
          'undeclared-feature',
          sp + '/speed',
          V && 'nonpositive speed requires motion',
          V && 'add "motion" to "requires"',
        );
      if ('pose' in sr === 'play' in sr)
        d.err('state-kind', sp, V && `state "${sname}" needs exactly one of "pose" and "play"`);
      if ('speed' in sr && !('play' in sr))
        d.err('state-kind', sp + '/speed', V && '"speed" only applies to "play" states');
      if (sr.pose) {
        st.pose = new Map();
        for (const [a, val] of entries(sr.pose)) {
          const pp = ptr(sp + '/pose', a);
          const ad = address(a, pp);
          const vv = ad && value(ad, val, pp);
          if (vv !== undefined) st.pose.set(a, vv);
        }
        st.writes = [...st.pose.keys()];
      }
      let tl: TimelineM | undefined;
      if (sr.play !== undefined) {
        const ti = tlIndex.get(sr.play);
        if (ti === undefined)
          d.err(
            'unknown-timeline',
            sp + '/play',
            V && `no timeline "${sr.play}"`,
            V && suggest(sr.play, tlIndex.keys()),
          );
        else {
          st.play = ti;
          tl = timelines[ti]!;
          st.writes = tl.tracks.map((t) => t.addr);
        }
      }
      (sr.on ?? []).forEach((tr: Raw, ti: number) => {
        const tp = `${sp}/on/${ti}`;
        const to = stateIdx(tr.to, tp + '/to');
        let terms = parseCondition(tr.when);
        // Scalar guards share bind's grammar. Trigger and clock terms keep their consumption
        // and time-boundary behavior; they are not ordinary boolean expression values.
        if (
          doc.requires?.includes('bind') &&
          /\b(?:or|not)\b|^\s*\(/.test(tr.when.replace(/"(?:[^"\\]|\\.)*"/g, ''))
        ) {
          const source = tr.when.replace(/("(?:[^"\\]|\\.)*"|&&|!(?!=))/g, (token: string) =>
            token === '&&' ? ' and ' : token === '!' ? 'not ' : token,
          );
          const run = inputExpression(model, source, 'bool', tp + '/when', d, (n) => used?.add(n));
          terms = run
            ? [{ k: 'expr', a: '', b: '', op: '==', test: (scope) => Boolean(run(scope)) }]
            : [];
        }
        const t: TransitionM = {
          actions: tr.actions ? action(tr.actions, tp + '/actions') : undefined,
          to,
          terms: [],
          triggers: [],
          blend: tr.blend ?? 0,
          ease: ease(tr.ease, tp + '/ease'),
          interruptible: tr.interruptible ?? true,
        };
        const wp = tp + '/when';
        if (typeof terms === 'string')
          d.err(
            'bad-condition',
            wp,
            V && `"${tr.when}": ${terms}`,
            V &&
              (/(^|\s)(not|or)\s/.test(String(tr.when))
                ? '"not" and "or" are bind-expression syntax: write !name, and one transition per "or" branch'
                : 'terms: name, !name, name OP number, @end, @after(s), joined with &&'),
          );
        else {
          t.terms = terms;
          for (const term of terms) {
            if (term.k === 'is') {
              const inp = needInput(
                term.name,
                wp,
                ['bool', 'trigger'],
                V && (term.not ? 'a bare "!name"' : 'a bare name'),
              );
              if (inp?.type === 'trigger') {
                if (term.not)
                  d.err('input-type', wp, V && `trigger "${term.name}" cannot be negated`);
                t.triggers.push(inp.name);
              }
            } else if (term.k === 'cmp') needInput(term.name, wp, ['number'], V && 'a comparison');
            else if (term.k === 'expr') {
              if (term.test) continue;
              if (literalCondition(model, term, wp, d) || model.guard?.(term, wp, d)) continue;
              const run = inputExpression(
                model,
                `${term.a} ${term.op} ${term.b}`,
                'bool',
                wp,
                d,
                (n) => used?.add(n),
              );
              if (run) term.test = (scope) => Boolean(run(scope));
            } else if (term.k === 'end' && (!tl || tl.loop !== 'once'))
              d.err(
                'bad-end',
                wp,
                V &&
                  (tl
                    ? `@end needs a "once" timeline; "${tl.name}" is ${tl.loop}`
                    : '@end needs a "play" state'),
              );
          }
          if (
            to === si &&
            !terms.some(
              (x) =>
                x.k === 'end' ||
                x.k === 'after' ||
                (x.k === 'is' && inputs.get(x.name)?.type === 'trigger'),
            )
          )
            d.err(
              'self-transition',
              wp,
              V && `"${sname}" → itself needs a trigger, @end or @after term`,
              V && 'otherwise it would re-enter every step',
            );
        }
        st.on.push(t);
      });
      layer.states.push(st);
    });
    // Reachability from the initial state (a warning: tooling only)
    if (V && layer.initial >= 0) {
      const seen = new Set([layer.initial]);
      const queue = [layer.initial];
      while (queue.length)
        for (const t of layer.states[queue.pop()!]!.on)
          if (t.to >= 0 && !seen.has(t.to)) {
            seen.add(t.to);
            queue.push(t.to);
          }
      names.forEach((n, i) => {
        if (!seen.has(i))
          d.warn('unreachable-state', ptr(lp + '/states', n), V && `no transition reaches "${n}"`);
      });
    }
    layers.push(layer);
  }

  // Listeners
  const listeners: ListenerM[] = [];
  (doc.listeners ?? []).forEach((r: Raw, i: number) => {
    const p = '/listeners/' + i;
    let target = -1;
    if (r.target !== undefined) {
      target = ids.get(r.target) ?? -1;
      if (target < 0)
        d.err(
          'unknown-target',
          p + '/target',
          V && `no node "${r.target}"`,
          V && suggest(r.target, ids.keys()),
        );
    }
    if (!['fire', 'set', 'toggle', 'emit', 'copy'].some((k) => k in r))
      d.err(
        'missing-key',
        p,
        V && 'listener has no action',
        V && 'add "fire", "set", "toggle" or "emit"',
      );
    listeners.push({ on: r.on, target, pad: r.hitPadding ?? 0, ...action(r, p) });
  });

  // Accessibility
  const a11y = doc.a11y;
  if (a11y) {
    for (const key of ['activate', 'pressed', 'held'])
      if (a11y[key])
        needInput(
          a11y[key],
          '/a11y/' + key,
          key === 'activate' ? ['trigger', 'bool'] : ['bool'],
          V && `"${key}"`,
        );
    if (a11y.role === 'switch' && !a11y.pressed)
      d.err(
        'missing-key',
        '/a11y',
        V && 'a switch needs "pressed"',
        V && 'name the bool input aria-checked follows',
      );
  }
  if (V)
    for (const n of inputs.keys())
      if (!n.startsWith('$') && !used!.has(n))
        d.warn('unused-input', ptr('/inputs', n), V && `nothing reads or writes "${n}"`);

  return Object.assign(model, { addrs, timelines, layers, listeners });
}

type Glyphs = Map<string, { d: string; sp: Subpath[] } | undefined>;

function pathOrError(src: string, p: string, d: Diags): Subpath[] | undefined {
  try {
    return parsePath(src);
  } catch (e) {
    if (!(e instanceof PathError)) throw e;
    d.err(
      'bad-path',
      p,
      V && `${e.message} at offset ${e.at}`,
      V && `near "${src.slice(Math.max(0, e.at - 8), e.at + 8)}"`,
    );
  }
}

function checkNode(
  n: NodeM,
  p: string,
  d: Diags,
  glyphs: Glyphs,
  checkPaint: (c: string, p: string) => void,
): void {
  const r = n.raw;
  if (n.type === 'path') {
    let all: Subpath[] | undefined;
    let src: string = r.d;
    if ('glyph' in r === 'd' in r)
      d.err('path-source', p, V && 'a path needs exactly one of "glyph" and "d"');
    else if ('glyph' in r) {
      const g = glyphs.get(r.glyph);
      if (g) [all, src] = [g.sp, g.d];
      // A glyph that failed to parse already has its bad-path error.
      else if (!glyphs.has(r.glyph))
        d.err(
          'unknown-glyph',
          p + '/glyph',
          V && `no glyph "${r.glyph}"`,
          V && (suggest(r.glyph, glyphs.keys()) ?? 'declare it in "glyphs"'),
        );
    } else all = pathOrError(r.d, p + '/d', d);
    if (all) {
      const pick: number[] | undefined = r.subpaths;
      const bad = pick?.findIndex((i, k) => i >= all.length || pick.indexOf(i) !== k) ?? -1;
      if (pick && bad >= 0)
        d.err(
          'bad-subpath',
          `${p}/subpaths/${bad}`,
          V &&
            `subpath ${pick[bad]} is ${pick[bad]! >= all.length ? `out of range (the path has ${all.length})` : 'repeated'}`,
        );
      else {
        Object.assign(n, selectSubpaths(src, all, pick));
      }
    }
  }
  if (!PAINTED.includes(n.type)) return;
  for (const kind of ['fill', 'stroke'])
    if (r[kind]?.color !== undefined) checkPaint(r[kind].color, p + '/' + kind + '/color');
  if (V && !r.fill && !r.stroke && !r.paints)
    d.warn('no-paint', p, V && `"${n.id}" has neither fill nor stroke`);
  if (n.type === 'arc') {
    if (r.fill)
      d.err('arc-fill', p + '/fill', V && 'arcs are open; they take a stroke, not a fill');
    const sweep = r.to - r.from;
    if (!(sweep > 0 && sweep <= 360))
      d.err(
        'bad-value',
        p + '/to',
        V && `to − from is ${sweep}`,
        V && 'arcs need 0 < to − from ≤ 360',
      );
  }
  const s = r.stroke;
  if (
    s &&
    n.geom &&
    n.geom.length > 1 &&
    ['trimStart', 'trimEnd', 'trimOffset'].some((k) => k in s)
  )
    d.err(
      'trim-multi-subpath',
      p + '/stroke',
      V && `"${n.id}" has ${n.geom.length} subpaths; trims need one`,
      V && 'select one with "subpaths"',
    );
}

/** Resolve `<id>.<property>`; returns an Addr or [code, message, hint]. */
export function resolveAddress(
  a: string,
  nodes: NodeM[],
  ids: Map<string, number>,
): Addr | [string, string | false, string | false] {
  const dot = a.indexOf('.');
  if (dot < 0)
    return [
      'unknown-address',
      V && `"${a}" is not an address`,
      V && `addresses look like <node-id>.<property>`,
    ];
  const id = a.slice(0, dot);
  const key = a.slice(dot + 1);
  const ni = ids.get(id);
  if (ni === undefined)
    return ['unknown-address', V && `no node "${id}"`, V && `${suggest(id, ids.keys()) ?? ''}`];
  const n = nodes[ni]!;
  for (const m of modules.values()) {
    const value = m.model?.(n, key);
    if (value) return { node: ni, key, ...value };
  }
  if (key === 'd') return ['reserved', V && 'd animation needs a paint-module path node', false];
  const m = /^(fill|stroke)\.(.+)$/.exec(key);
  if (m) {
    const paint = m[1] as 'fill' | 'stroke';
    const field = m[2]!;
    if (!PAINTED.includes(n.type) || !n.raw[paint])
      return ['unknown-address', V && `"${id}" has no ${paint}`, false];
    const prop = Object.hasOwn(PAINT[paint], field) ? PAINT[paint][field] : undefined;
    if (!prop) {
      if (Object.hasOwn((nodeShape(n.type).p[paint] as ObjShape).p, field))
        return ['not-animatable', V && `${paint}.${field} cannot be animated`, false];
      return [
        'unknown-address',
        V && `${paint} has no "${field}"`,
        V && `${suggest(field, Object.keys(PAINT[paint])) ?? ''}`,
      ];
    }
    const raw = n.raw[paint][field];
    if (raw === undefined && prop.def === undefined)
      return ['unknown-address', V && `no value for ${key}`, false];
    const rest: Value = prop.type === 'color' ? (parseHex(raw) ?? raw) : (raw ?? prop.def);
    return { node: ni, key, prop, rest };
  }
  const props = { ...COMMON, ...OWN[n.type] };
  const prop = Object.hasOwn(props, key) ? props[key] : undefined;
  if (!prop) {
    if (
      Object.hasOwn(STATIC[n.type], key) ||
      ['pivot', 'id', 'type', 'fill', 'stroke', 'knockout'].includes(key)
    )
      return [
        'not-animatable',
        V && `"${key}" cannot be animated`,
        V && `${key === 'pivot' || key === 'center' ? 'animate x and y instead' : ''}`,
      ];
    return [
      'unknown-address',
      V && `${n.type} "${id}" has no property "${key}"`,
      V && `${suggest(key, Object.keys(props)) ?? ''}`,
    ];
  }
  return { node: ni, key, prop, rest: n.raw[key] ?? prop.def };
}
