// <anima-icon>: the Anima web runtime (ARCHITECTURE §web). Retained SVG DOM built from the core's
// scene, one shared requestAnimationFrame loop that sleeps when every icon has settled, Pointer
// Events through the core's hit test, keyboard and ARIA per spec §10, CSS theming via slots.

import {
  type AnimaEvent,
  type Attrs,
  type DrawFrame,
  type Diagnostic,
  type El,
  type Model,
  type ObjShape,
  DOC,
  FILL,
  STROKE,
  Player,
  svgAttrs,
  cssSlots,
  clamp,
  load,
  sceneTree,
  registerModule,
  modules,
  drawFrame,
  registerSVGBackend,
} from '@anima-format/core';

export type { AnimaEvent, Diagnostic };

/** Optional source compiler diagnostics may carry authoring positions. */
export interface SourceDiagnostic extends Diagnostic {
  line?: number;
  column?: number;
}

/** Optional renderers own drawing, layout and coordinate mapping; playback stays in the host. */
export interface IconRenderer {
  draw(frame: DrawFrame, force: boolean): void;
  layout(): void;
  point(x: number, y: number): DOMPoint;
  connect(): void;
  disconnect(): void;
  destroy(): void;
}

const SVG = 'http://www.w3.org/2000/svg';
const MAX_DT = 0.25;

// ---------------------------------------------------------------- shared scheduler

const active = new Set<AnimaIcon>();
let frame = 0;

function tick(now: number): void {
  frame = 0;
  for (const icon of active) icon.frame(now);
  if (active.size && !frame) frame = requestAnimationFrame(tick);
}

function schedule(icon: AnimaIcon, on: boolean): void {
  if (on) active.add(icon);
  else active.delete(icon);
  if (!active.size && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  } else if (active.size && !frame) frame = requestAnimationFrame(tick);
}

let seen: IntersectionObserver | undefined;
const motionQuery = () => matchMedia('(prefers-reduced-motion: reduce)');

// Successful documents only. Objects are weakly held; text uses a 16-entry LRU.
let objects = new WeakMap<object, ReturnType<typeof load>>();
const sources = new Map<string, ReturnType<typeof load>>();
const authored = new Map<string, Promise<{ doc?: object; diagnostics: SourceDiagnostic[] }>>();
let ids = 0;

export class AnimaIcon extends HTMLElement {
  /** Instantiate a compiled model without reparsing or recompiling it. */
  loadModel(model: Model): void {
    this.#model = model;
    const selected = AnimaIcon.selectModel?.(this, model);
    if (selected && !selected.model) {
      this.#fail(selected.diagnostics);
      return;
    }
    model = selected?.model ?? model;
    this.#retry = undefined;
    ++this.#generation;
    this.#destroyed = false;
    this.#listen();
    this.#observe();
    schedule(this, false);
    this.#last = -1;
    this.#states = '';
    this.#held = 0;
    AnimaIcon.eventHook?.(this, 'cleanup', null);
    this.player = undefined;
    const generation = this.#generation;
    const finish = (prepare?: (player: Player) => boolean) => {
      if (generation !== this.#generation) return;
      this.player = new Player(model);
      const player = this.player;
      this.#prepare = prepare || undefined;
      this.#resources(player);
      player.onChange = () => {
        if (this.player === player) this.#wake();
      };
      this.#build(model);
      this.#motion();
      this.#aria();
      if (!this.hasAttribute('paused')) {
        AnimaIcon.eventHook?.(this, 'play', null);
        this.#step(0);
        // An entry-event listener loaded another document or destroyed the icon.
        if (generation !== this.#generation) return;
      }
      this.#resolve();
      this.dispatchEvent(new CustomEvent('anima:load', { detail: this.info }));
    };
    if (model.doc.assets && AnimaIcon.loadAssets) {
      AnimaIcon.loadAssets(this, model).then(finish, (d: unknown) => {
        // A loader may reject with a plain Error (e.g. no base URL): report it, so `ready` settles.
        if (generation === this.#generation)
          this.#fail(
            Array.isArray(d)
              ? d
              : [{ code: 'asset-load', severity: 'error', pointer: '/assets', message: String(d) }],
          );
      });
    } else finish();
  }

  /** Wake sources that were loaded before their compiler or runtime modules registered. */
  static registration = 0;
  static refresh(): void {
    this.registration++;
    objects = new WeakMap();
    sources.clear();
    authored.clear();
    queueMicrotask(() => dispatchEvent(new Event('anima:register')));
  }
  static markupHooks: Record<string, object> = {};
  static registerMarkup(name: string, hooks: object): void {
    this.markupHooks[name] = hooks;
    this.refresh();
  }
  static registerModule(m: Parameters<typeof registerModule>[0]): void {
    registerModule(m);
    AnimaIcon.refresh();
  }
  /** Events claimed by browser adapters, shared across separately built module bundles. */
  static inputEvents = new WeakSet<Event>();
  static registerSVGBackend = registerSVGBackend;
  static modules = modules;
  /** Live shapes include module init extensions as well as replayable entries. */
  static registry = { DOC: DOC as ObjShape, FILL: FILL as ObjShape, STROKE: STROKE as ObjShape };
  /** Installed by the composite SVG backend; 0.1 scenes keep authored DOM order. */
  declare static orderSVG?: (frame: DrawFrame, elements: [El, Element, Attrs][]) => void;
  declare static selectModel?: (icon: AnimaIcon, model: Model) => ReturnType<typeof load>;
  declare static sourceLoader?: (icon: AnimaIcon, url: string) => Promise<string | Model>;
  declare static loadAssets?: (
    icon: AnimaIcon,
    model: Model,
  ) => Promise<undefined | ((player: Player) => boolean)>;
  declare static eventHook?: (icon: AnimaIcon, kind: string, detail: unknown) => void;
  // seam(P7-3): optional host viewport, shared with canvas and input adapters.
  declare static viewBox?: (icon: AnimaIcon, svg?: SVGSVGElement) => number[] | undefined;
  static renderers: Record<string, (icon: AnimaIcon) => IconRenderer> = {};
  #renderer?: IconRenderer;
  #prepare?: (player: Player) => boolean;
  #model?: Model;
  static observedAttributes = [
    'src',
    'motion',
    'label',
    'speed',
    'paused',
    'alignment',
    'fit',
    'align',
    'renderer',
  ];
  /** Registered by @anima-format/web/markup; the runtime never imports a compiler itself. */
  declare static compiler?: (source: string) => { doc?: object; diagnostics: SourceDiagnostic[] };

  /** The player, once loaded (for debugging and tests). */
  player?: Player;
  declare static compilerAsync?: (
    source: string,
    file: string,
  ) => Promise<{ doc?: object; diagnostics: SourceDiagnostic[] }>;

  /** Resolves when a document has loaded; rejects with its diagnostics. */
  ready: Promise<void>;
  /** Set to an array to record every step, pointer event and input write (for replays). */
  trace?: unknown[][];

  #retry?: () => void;
  #registered = () => {
    if (!this.#retry || !this.isConnected || this.#destroyed) return;
    this.ready = new Promise((res, rej) => {
      this.#resolve = res;
      this.#reject = rej;
    });
    this.ready.catch(() => {});
    this.#retry();
  };
  #resolve!: () => void;
  #reject!: (d: Diagnostic[]) => void;
  #root: ShadowRoot;
  #svg?: SVGSVGElement;
  #els: [El, Element, Attrs][] = [];
  #last = -1;
  #onScreen = true;
  #states = '';
  /** Host-added tabindex (1) and cursor (2). */
  #owned = 0;
  /** Held Enter (1) and Space (2) keys. */
  #held = 0;
  #listeners?: AbortController;
  #observing = false;
  #destroyed = false;
  #generation = 0;
  #query = motionQuery();
  #mid = 'a' + ++ids + '-';

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.ready = new Promise((res, rej) => {
      this.#resolve = res;
      this.#reject = rej;
    });
    this.ready.catch(() => {});
    this.#listen();
  }

  #listen(): void {
    if (this.#listeners) return;
    this.#listeners = new AbortController();
    for (const [type, fn] of [
      ['pointermove', (e: PointerEvent) => this.#ptr('move', e)],
      ['pointerdown', (e: PointerEvent) => e.button === 0 && this.#ptr('down', e)],
      ['pointerup', (e: PointerEvent) => e.button === 0 && this.#ptr('up', e)],
      ['pointerleave', (e: PointerEvent) => this.#ptr('leave', e)],
      ['pointercancel', (e: PointerEvent) => this.#ptr('leave', e)],
      ['keydown', (e: KeyboardEvent) => this.#key(e, true)],
      ['keyup', (e: KeyboardEvent) => this.#key(e, false)],
      ['blur', () => this.#hold(0)],
    ] as const)
      this.addEventListener(type, fn as EventListener, { signal: this.#listeners.signal });
  }

  set src(value: string) {
    this.setAttribute('src', value);
  }
  get src(): string | null {
    return this.getAttribute('src');
  }

  connectedCallback(): void {
    if (this.#destroyed) return;
    this.#listen();
    // Let optional modules register after customElements.define upgrades existing elements.
    queueMicrotask(() => {
      if (this.isConnected && !this.#destroyed && !this.player) {
        if (this.#retry) {
          this.#registered();
          return;
        }
        const inline = this.querySelector<HTMLScriptElement>(
          'script[type="application/vnd.anima+json"],script[type="application/vnd.anima+xml"]',
        );
        if (inline) void this.#source(inline.text, inline.type.endsWith('xml'), document.baseURI);
      }
    });
    this.#observe();
    this.#renderer?.connect();
    this.#layout(); // seam(P7-3): reconnect the optional resize observer.
    if (this.player?.busy) this.#wake();
  }

  #observe(): void {
    if (this.#observing || !this.isConnected) return;
    this.#observing = true;
    addEventListener('anima:register', this.#registered);
    (seen ??= new IntersectionObserver((es) => {
      for (const e of es) (e.target as AnimaIcon).#visible(e.isIntersecting);
    })).observe(this);
    this.#query.addEventListener('change', this.#motion);
    document.addEventListener('visibilitychange', this.#motion);
  }

  disconnectedCallback(): void {
    AnimaIcon.eventHook?.(this, 'cleanup', null);
    this.#renderer?.disconnect();
    this.#observing = false;
    removeEventListener('anima:register', this.#registered);
    seen?.unobserve(this);
    this.#query.removeEventListener('change', this.#motion);
    document.removeEventListener('visibilitychange', this.#motion);
    schedule(this, false);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'src' && value) {
      const generation = ++this.#generation;
      (AnimaIcon.sourceLoader?.(this, value) ?? fetch(value).then((r) => r.text())).then(
        (t) => {
          if (generation === this.#generation)
            void this.#source(
              t,
              /\.animl(?:[?#]|$)/.test(value),
              new URL(value, document.baseURI).href,
            );
        },
        () => {
          if (generation !== this.#generation) return;
          this.#fail([
            { code: 'fetch', severity: 'error', pointer: '', message: `cannot fetch ${value}` },
          ]);
        },
      );
    } else if (name === 'motion') this.#motion();
    else if (name === 'label') this.#aria();
    else if (name === 'paused') {
      if (_old !== value) AnimaIcon.eventHook?.(this, value === null ? 'play' : 'pause', null);
      if (value !== null) schedule(this, false);
      else if (this.player) {
        this.#step(0);
        if (this.player?.busy) this.#wake();
      }
    } else if (name === 'renderer' && this.player) this.#build(this.player.model);
    else if (name === 'fit' || name === 'align' || name === 'alignment') this.#layout();
    else if (name === 'speed') {
      if (this.speed === 0) schedule(this, false);
      else if (this.player?.busy) this.#wake();
    }
  }

  async #source(source: string | Model, markup: boolean, file: string): Promise<void> {
    if (typeof source !== 'string') {
      this.loadModel(source);
      return;
    }
    const retry = () => {
      void this.#source(source, markup, file);
    };
    this.#retry = undefined;
    const registration = AnimaIcon.registration;
    if (markup && AnimaIcon.compilerAsync) {
      const generation = this.#generation;
      const key = JSON.stringify([file, source]);
      let pending = authored.get(key);
      if (!pending) {
        pending = AnimaIcon.compilerAsync(source, file);
        authored.set(key, pending);
        if (authored.size > 16) authored.delete(authored.keys().next().value!);
        pending.then(
          (r) => {
            if (!r.doc) authored.delete(key);
          },
          () => authored.delete(key),
        );
      } else {
        authored.delete(key);
        authored.set(key, pending);
      }
      const result = await pending;
      if (generation !== this.#generation || this.#destroyed) return;
      if (result.doc) this.load(result.doc);
      else if (registration !== AnimaIcon.registration) return this.#source(source, markup, file);
      else {
        this.#retry = retry;
        this.#fail(result.diagnostics);
      }
    } else this.load(source, markup);
    this.#retry &&= retry;
  }

  /** Load a document (text or parsed). Returns its diagnostics; errors leave the icon empty. */
  load(doc: string | object, markup = false): SourceDiagnostic[] {
    this.#retry = () => {
      this.load(doc, markup);
    };
    const compiled = AnimaIcon.compile(doc, markup);
    const selected = compiled.model && AnimaIcon.selectModel?.(this, compiled.model);
    const model = selected ? selected.model : compiled.model;
    const diagnostics = [...compiled.diagnostics, ...(selected?.diagnostics ?? [])];
    if (!model) {
      this.#fail(diagnostics);
      return diagnostics;
    }
    this.loadModel(model);
    return diagnostics;
  }

  /** Shared successful compilation; callers treat parsed documents as immutable. */
  static compile(doc: string | object, markup = false): ReturnType<typeof load> {
    const key = typeof doc === 'string' ? (markup ? 'm' : 'j') + doc : undefined;
    const cached = key === undefined ? objects.get(doc as object) : sources.get(key);
    if (cached) {
      if (key !== undefined) {
        sources.delete(key);
        sources.set(key, cached);
      }
      return cached;
    }
    const compiled =
      markup && typeof doc === 'string'
        ? (AnimaIcon.compiler?.(doc) ?? {
            diagnostics: [
              {
                code: 'markup-unavailable',
                severity: 'error' as const,
                pointer: '',
                message: 'load @anima-format/web/markup or run anima build page.html',
              },
            ],
          })
        : undefined;
    const result =
      compiled && !compiled.doc
        ? { model: undefined, diagnostics: compiled.diagnostics }
        : load(compiled?.doc ?? doc);
    if (result.model) {
      if (key === undefined) objects.set(doc as object, result);
      else {
        sources.set(key, result);
        if (sources.size > 16) sources.delete(sources.keys().next().value!);
      }
    }
    return result;
  }

  /** Nonnegative playback rate. Invalid attribute values use 1. */
  get speed(): number {
    const value = Number(this.getAttribute('speed') ?? 1);
    return Number.isFinite(value) && value >= 0 ? value : 1;
  }

  set speed(value: number) {
    this.setAttribute('speed', String(Number.isFinite(value) && value >= 0 ? value : 1));
  }

  get playback(): 'empty' | 'paused' | 'playing' | 'settled' {
    if (!this.player) return 'empty';
    if (this.hasAttribute('paused')) return 'paused';
    return this.player.busy ? 'playing' : 'settled';
  }

  pause(): void {
    this.setAttribute('paused', '');
  }

  stop(): void {
    this.setAttribute('paused', '');
  }

  play(): void {
    if (this.hasAttribute('paused')) this.removeAttribute('paused');
    else if (this.player?.busy) this.#wake();
  }

  get(name: string): import('../../core/src/load.ts').Value | undefined {
    return this.player?.get(name);
  }

  /** A detached summary; editing it does not edit the loaded model. */
  get info() {
    const m = this.player?.model;
    if (!m) return null;
    return {
      name: m.doc.name,
      title: m.doc.title,
      grid: m.grid,
      viewBox: [...m.viewBox],
      inputs: [...m.inputs.values()].map((i) => ({
        name: i.name,
        type: i.type,
        default: Array.isArray(i.def) ? [...i.def] : i.def,
        ...(i.type === 'number' && Number.isFinite(i.min) ? { min: i.min } : {}),
        ...(i.type === 'number' && Number.isFinite(i.max) ? { max: i.max } : {}),
      })),
      timelines: m.timelines.map((t) => ({ name: t.name, duration: t.duration, loop: t.loop })),
      layers: m.layers.map((l) => ({
        name: l.name,
        initial: l.states[l.initial]!.name,
        states: l.states.map((s) => s.name),
      })),
    };
  }

  reset(): void {
    // The compiled model as loaded: the player's model may be a runtime fork (repeat expansion).
    if (this.player) this.loadModel(this.#model!);
  }

  destroy(): void {
    ++this.#generation;
    this.#destroyed = true;
    this.#retry = undefined;
    this.disconnectedCallback();
    this.#listeners?.abort();
    this.#listeners = undefined;
    this.player = undefined;
    this.#prepare = undefined;
    this.#renderer?.destroy();
    this.#renderer = undefined;
    this.#svg = undefined;
    this.#els = [];
    this.#root.replaceChildren();
    this.#held = 0;
    this.#aria();
  }

  /** Repaint retained elements without advancing the player or scheduling a frame. */
  invalidate(): void {
    if (this.player) {
      for (const rec of this.#els) rec[2] = {};
      this.#draw(true);
    }
  }

  /** Set a bool or number input. */
  set(name: string, value: number | boolean): void {
    this.trace?.push(['set', name, value]);
    this.player?.set(name, value);
    this.#wake();
  }

  fire(name: string): void {
    this.trace?.push(['fire', name]);
    this.player?.fire(name);
    this.#wake();
  }

  toggle(name: string): void {
    this.trace?.push(['toggle', name]);
    this.player?.toggle(name);
    this.#wake();
  }

  /** Every animated address and its current value. */
  values(): Record<string, number | boolean | string> {
    return this.player?.values() ?? {};
  }

  #fail(d: SourceDiagnostic[]): void {
    const retry = this.#retry;
    AnimaIcon.eventHook?.(this, 'loaderror', d);
    this.destroy();
    if (retry) {
      this.#destroyed = false;
      this.#retry = retry;
      this.#listen();
      this.#observe();
    }
    console.error(
      `anima-icon: ${d.map((x) => `${x.message} at ${x.line ? `${x.line}:${x.column}` : x.pointer || '/'}`).join(', ')}`,
    );
    this.dispatchEvent(new CustomEvent('anima:error', { detail: d }));
    this.#reject(d);
  }

  // ------------------------------------------------------------ DOM

  #build(m: Model): void {
    this.#renderer?.destroy();
    this.#renderer = undefined;
    this.#svg = undefined;
    this.#els = [];
    const renderer = this.getAttribute('renderer');
    if (renderer && renderer !== 'svg') {
      this.#root.replaceChildren();
      const factory = AnimaIcon.renderers[renderer];
      if (factory) {
        this.#renderer = factory(this);
        this.#draw(true); // seam(P7-3): publish renderer rebuilds to the semantic overlay.
      } else
        this.dispatchEvent(
          new CustomEvent('anima:error', {
            detail: [
              {
                code: 'unsupported-render',
                severity: 'error',
                pointer: '',
                message: `renderer ${renderer} is unavailable`,
                hint: 'import @anima-format/web/' + renderer,
              },
            ],
          }),
        );
      return;
    }
    const [x, y, w, h] = m.viewBox;
    const g = m.grid;
    const pct = (v: number) => (v / g) * 100 + '%';
    this.#root.innerHTML = `<style>:host{display:inline-block;position:relative;width:1em;aspect-ratio:${w}/${h};vertical-align:-.125em;touch-action:manipulation;-webkit-tap-highlight-color:transparent}svg{position:absolute;left:${pct(x)};top:${pct(y)};width:${pct(w)};height:${pct(h)};overflow:visible}</style>`;
    const svg = (this.#svg = document.createElementNS(SVG, 'svg'));
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    svg.setAttribute('aria-hidden', 'true');
    this.#els = [];
    const make = (el: El, parent: Element) => {
      const d = document.createElementNS(SVG, el.tag);
      parent.append(d);
      const rec: [El, Element, Attrs] = [el, d, {}];
      this.#els.push(rec);
      for (const k of el.kids) make(k, d);
    };
    const { root, defs } = sceneTree(m);
    if (defs.length) {
      const dd = document.createElementNS(SVG, 'defs');
      svg.append(dd);
      for (const el of defs) make(el, dd);
    }
    for (const el of root) make(el, svg);
    this.#root.append(svg);
    this.#layout();
    this.#draw(true);
  }

  #layout(): void {
    const svg = this.#svg;
    if (svg && AnimaIcon.viewBox?.(this, svg)) return; // seam(P7-3)
    this.#renderer?.layout();
    const m = this.player?.model;
    if (!svg || !m) return;
    const fit = this.getAttribute('fit');
    let align = this.getAttribute('align') ?? 'center';
    // seam(P7-3): equivalent legacy fit math offsets the hook's byte cost.
    if (!/^(center|(?:top|bottom)(?:-left|-right)?|left|right)$/.test(align)) align = 'center';
    const position = (min: string, max: string) =>
      align.includes(min) ? 'Min' : align.includes(max) ? 'Max' : 'Mid';
    const x = position('left', 'right');
    const y = position('top', 'bottom');
    svg.setAttribute(
      'preserveAspectRatio',
      fit === 'fill' ? 'none' : `x${x}Y${y} ${fit === 'cover' ? 'slice' : 'meet'}`,
    );
    if (fit === 'none') {
      const offset = (part: string, size: number) => {
        const fraction = part === 'Min' ? 0 : part === 'Mid' ? 0.5 : 1;
        return `calc(${100 * fraction}% - ${size * fraction}px)`;
      };
      svg.style.width = m.viewBox[2] + 'px';
      svg.style.height = m.viewBox[3] + 'px';
      svg.style.left = offset(x, m.viewBox[2]);
      svg.style.top = offset(y, m.viewBox[3]);
    } else svg.removeAttribute('style');
  }

  #order(): void {
    AnimaIcon.orderSVG?.(drawFrame(this.player!), this.#els);
  }

  #resources(p: Player): boolean {
    if (!this.#prepare) return false;
    let changed = this.#prepare(p);
    const nested = p.nested as
      { players?: Map<string, Player>; sources?: Map<number, Player> } | undefined;
    const lists = AnimaIcon.modules.get('lists') as
      typeof import('../../../modules/lists/core/index.ts').lists | undefined;
    for (const child of [
      ...(nested?.players?.values() ?? []),
      // Component paint source players (componentpaint) resolve per host too.
      ...(nested?.sources?.values() ?? []),
      ...(lists?.listState(p)?.runs.flatMap((r) => r.items.map((i) => i.player)) ?? []),
    ])
      changed = this.#resources(child) || changed;
    if (changed) p.drawVersions.fill(++p.drawRevision);
    return changed;
  }

  #draw(all = false): void {
    this.#resources(this.player!);
    const f = drawFrame(this.player!);
    if (this.#renderer) {
      this.#renderer.draw(f, all);
      AnimaIcon.eventHook?.(this, 'draw', { revision: f.revision });
      return;
    }
    const changed = new Set(f.changed);
    for (const [el, d, cur] of this.#els) {
      if (!all && !changed.has(el.node)) continue;
      const next = svgAttrs(f, el, cssSlots, this.#mid);
      for (const k in next) {
        const v = next[k]!;
        if (v === cur[k]) continue;
        if (v === null) d.removeAttribute(k);
        else d.setAttribute(k, v);
        cur[k] = v;
      }
    }
    this.#order();
    AnimaIcon.eventHook?.(this, 'draw', { revision: f.revision });
  }

  #aria(): void {
    const a = this.player?.model.doc.a11y;
    const label = this.getAttribute('label') ?? a?.label;
    const button = a?.role === 'button' || a?.role === 'switch';
    const set = (k: string, v: string | null) =>
      v === null ? this.removeAttribute(k) : this.setAttribute(k, v);
    set('role', button ? a.role : label ? 'img' : null);
    set('aria-label', label ?? null);
    set('aria-hidden', label || button ? null : 'true');
    // Button affordances the host added go away with button semantics; author values stay.
    if (button) {
      if (!this.hasAttribute('tabindex')) {
        this.tabIndex = 0;
        this.#owned |= 1;
      }
      if (!this.style.cursor) {
        this.style.cursor = 'pointer';
        this.#owned |= 2;
      }
    } else {
      if (this.#owned & 1 && this.getAttribute('tabindex') === '0')
        this.removeAttribute('tabindex');
      if (this.#owned & 2 && this.style.cursor === 'pointer') this.style.cursor = '';
      this.#owned = 0;
    }
    const sw = a?.role === 'switch';
    set(sw ? 'aria-pressed' : 'aria-checked', null);
    set(
      sw ? 'aria-checked' : 'aria-pressed',
      a?.pressed ? String(!!this.player!.get(a.pressed)) : null,
    );
    this.#pressed();
  }

  /** The pressed/checked state follows its input after every step, machine or not. */
  #pressed(): void {
    const a = this.player?.model.doc.a11y;
    if (!a?.pressed) return;
    const k = a.role === 'switch' ? 'aria-checked' : 'aria-pressed';
    const v = String(!!this.player!.get(a.pressed));
    if (this.getAttribute(k) !== v) this.setAttribute(k, v);
  }

  // ------------------------------------------------------------ time

  #step(dt: number): void {
    const p = this.player!;
    this.trace?.push(['step', dt]);
    const { events, settled } = p.step(dt);
    this.#draw();
    AnimaIcon.eventHook?.(this, 'advance', { dt, events, settled });
    for (const e of events) {
      AnimaIcon.eventHook?.(this, 'event', e);
      this.dispatchEvent(
        new CustomEvent('anima:event', { detail: e, bubbles: true, composed: true }),
      );
      // A listener replaced or destroyed the player: its later events and states are stale.
      if (this.player !== p) return;
    }
    this.#pressed();
    const states = JSON.stringify(p.states());
    if (states !== this.#states) {
      this.#states = states;
      AnimaIcon.eventHook?.(this, 'statechange', p.states());
      this.#aria();
      this.dispatchEvent(
        new CustomEvent('anima:state', { detail: p.states(), bubbles: true, composed: true }),
      );
    }
    // Event and state listeners may have queued input (still busy) or replaced the player.
    if (this.player === p && !p.busy) schedule(this, false);
  }

  /** Called by the shared loop. */
  frame(now: number): void {
    if (!this.player || this.hasAttribute('paused') || this.speed === 0 || !this.isConnected) {
      schedule(this, false);
      return;
    }
    const dt = this.#last < 0 ? 0 : clamp((now - this.#last) / 1000, 0, MAX_DT);
    this.#last = now;
    this.#step(dt * this.speed);
  }

  #wake(): void {
    if (
      !this.player ||
      this.hasAttribute('paused') ||
      this.speed === 0 ||
      !this.isConnected ||
      !this.#onScreen ||
      document.hidden
    )
      return;
    if (!active.has(this)) this.#last = performance.now();
    schedule(this, true);
  }

  #visible(on: boolean): void {
    this.#onScreen = on;
    if (this.#destroyed) return;
    if (on && this.player?.busy && !this.hasAttribute('paused') && !document.hidden) {
      this.#last = -1;
      this.#step(0);
      if (this.player?.busy) this.#wake();
    } else if (!on) schedule(this, false);
  }

  #motion = (): void => {
    if (!this.player) return;
    const m = this.getAttribute('motion');
    this.player.reducedMotion = m === 'reduce' || (m !== 'full' && this.#query.matches);
    if (document.hidden) schedule(this, false);
    else if (this.player.busy) this.#wake();
  };

  // ------------------------------------------------------------ input

  #ptr(kind: 'move' | 'down' | 'up' | 'leave', e: PointerEvent): void {
    if (
      AnimaIcon.inputEvents.has(e) ||
      (e.composedPath()[0] as Element).hasAttribute('data-semantic')
    )
      return;
    const p = this.player;
    if (!p || (!this.#svg && !this.#renderer)) return;
    let x = 0;
    let y = 0;
    if (kind !== 'leave') {
      const m = this.#svg?.getScreenCTM()?.inverse();
      if (!m && !this.#renderer) return;
      ({ x, y } = this.#renderer
        ? this.#renderer.point(e.clientX, e.clientY)
        : new DOMPoint(e.clientX, e.clientY).matrixTransform(m!));
      if (kind === 'down') this.setPointerCapture?.(e.pointerId);
    }
    this.trace?.push(['pointer', kind, x, y]);
    p.pointer(kind, x, y);
    if (!this.hasAttribute('paused')) this.#step(0);
    this.#wake();
  }

  #key(e: KeyboardEvent, down: boolean): void {
    if (
      AnimaIcon.inputEvents.has(e) ||
      (e.composedPath()[0] as Element).hasAttribute('data-semantic')
    )
      return;
    const a = this.player?.model.doc.a11y;
    if (!a || (a.role !== 'button' && a.role !== 'switch') || (e.key !== 'Enter' && e.key !== ' '))
      return;
    e.preventDefault();
    if (down && e.repeat) return;
    // Enter activates on key down, Space on key up — as native buttons do.
    if (a.activate && (e.key === 'Enter') === down) {
      if (this.player!.model.inputs.get(a.activate)!.type === 'bool') this.toggle(a.activate);
      else this.fire(a.activate);
    }
    const bit = e.key === 'Enter' ? 1 : 2;
    this.#hold(down ? this.#held | bit : this.#held & ~bit);
  }

  #hold(keys: number): void {
    const a = this.player?.model.doc.a11y;
    const was = this.#held;
    this.#held = keys;
    if (a?.held && !was !== !keys) this.set(a.held, !!keys);
  }
}

if (!customElements.get('anima-icon')) customElements.define('anima-icon', AnimaIcon);

declare global {
  interface HTMLElementTagNameMap {
    'anima-icon': AnimaIcon;
  }
}
