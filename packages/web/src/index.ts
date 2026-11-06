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

let ids = 0;

export class AnimaIcon extends HTMLElement {
  /** Wake sources that were loaded before their compiler or runtime modules registered. */
  static registration = 0;
  static refresh(): void {
    this.registration++;
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
  static registerSVGBackend = registerSVGBackend;
  static modules = modules;
  /** Live shapes include module init extensions as well as replayable entries. */
  static registry = { DOC: DOC as ObjShape, FILL: FILL as ObjShape, STROKE: STROKE as ObjShape };
  /** Installed by the composite SVG backend; 0.1 scenes keep authored DOM order. */
  declare static orderSVG?: (frame: DrawFrame, elements: [El, Element, Attrs][]) => void;
  declare static loadAssets?: (icon: AnimaIcon, model: Model) => Promise<void>;
  declare static eventHook?: (icon: AnimaIcon, kind: string, detail: unknown) => void;
  static renderers: Record<string, (icon: AnimaIcon) => IconRenderer> = {};
  #renderer?: IconRenderer;
  static observedAttributes = [
    'src',
    'motion',
    'label',
    'speed',
    'paused',
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
  #held = false;
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
      ['pointerleave', () => this.#ptr('leave')],
      ['pointercancel', () => this.#ptr('leave')],
      ['keydown', (e: KeyboardEvent) => this.#key(e, true)],
      ['keyup', (e: KeyboardEvent) => this.#key(e, false)],
      ['blur', () => this.#hold(false)],
    ] as const)
      this.addEventListener(type, fn as EventListener, { signal: this.#listeners.signal });
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
      fetch(value)
        .then((r) => r.text())
        .then(
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
        if (this.player.busy) this.#wake();
      }
    } else if (name === 'renderer' && this.player) this.#build(this.player.model);
    else if (name === 'fit' || name === 'align') this.#layout();
    else if (name === 'speed') {
      if (this.speed === 0) schedule(this, false);
      else if (this.player?.busy) this.#wake();
    }
  }

  async #source(source: string, markup: boolean, file: string): Promise<void> {
    const retry = () => {
      void this.#source(source, markup, file);
    };
    this.#retry = undefined;
    const registration = AnimaIcon.registration;
    if (markup && AnimaIcon.compilerAsync) {
      const generation = this.#generation;
      const result = await AnimaIcon.compilerAsync(source, file);
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
    const { model, diagnostics } =
      compiled && !compiled.doc
        ? { model: undefined, diagnostics: compiled.diagnostics }
        : load(compiled?.doc ?? doc);
    if (!model) {
      this.#fail(diagnostics);
      return diagnostics;
    }
    this.#retry = undefined;
    ++this.#generation;
    this.#destroyed = false;
    this.#listen();
    this.#observe();
    schedule(this, false);
    this.#last = -1;
    this.#states = '';
    this.#held = false;
    AnimaIcon.eventHook?.(this, 'cleanup', null);
    this.player = undefined;
    const generation = this.#generation;
    const finish = () => {
      if (generation !== this.#generation) return;
      this.player = new Player(model);
      const player = this.player;
      player.onChange = () => {
        if (this.player === player) this.#wake();
      };
      this.#build(model);
      this.#motion();
      this.#aria();
      if (!this.hasAttribute('paused')) {
        AnimaIcon.eventHook?.(this, 'play', null);
        this.#step(0);
      }
      this.#resolve();
      this.dispatchEvent(new CustomEvent('anima:load', { detail: this.info }));
    };
    if (model.doc.assets && AnimaIcon.loadAssets) {
      AnimaIcon.loadAssets(this, model).then(finish, (d: SourceDiagnostic[]) => {
        if (generation === this.#generation) this.#fail(d);
      });
    } else finish();
    return diagnostics;
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
        default: i.def,
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
    if (this.player) this.load(this.player.model.doc);
  }

  destroy(): void {
    ++this.#generation;
    this.#destroyed = true;
    this.#retry = undefined;
    this.disconnectedCallback();
    this.#listeners?.abort();
    this.#listeners = undefined;
    this.player = undefined;
    this.#renderer?.destroy();
    this.#renderer = undefined;
    this.#svg = undefined;
    this.#els = [];
    this.#root.replaceChildren();
    this.#held = false;
    this.#aria();
  }

  /** Repaint retained elements without advancing the player or scheduling a frame. */
  invalidate(): void {
    if (this.player) {
      for (const rec of this.#els) rec[2] = {};
      this.#draw(true);
    } else this.#order();
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
        this.#renderer.draw(drawFrame(this.player!), true);
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
    this.#root.innerHTML = `<style>:host{display:inline-block;position:relative;width:1em;height:1em;vertical-align:-.125em;touch-action:manipulation;-webkit-tap-highlight-color:transparent}svg{position:absolute;left:${pct(x)};top:${pct(y)};width:${pct(w)};height:${pct(h)};overflow:visible}</style>`;
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
    this.#renderer?.layout();
    const svg = this.#svg;
    const m = this.player?.model;
    if (!svg || !m) return;
    const fit = this.getAttribute('fit');
    const align = this.getAttribute('align') ?? 'center';
    const valid = [
      'center',
      'top-left',
      'top',
      'top-right',
      'left',
      'right',
      'bottom-left',
      'bottom',
      'bottom-right',
    ].includes(align);
    const position = (min: string, max: string) =>
      valid && align.includes(min) ? 'Min' : valid && align.includes(max) ? 'Max' : 'Mid';
    const x = position('left', 'right');
    const y = position('top', 'bottom');
    svg.setAttribute(
      'preserveAspectRatio',
      fit === 'fill' ? 'none' : `x${x}Y${y} ${fit === 'cover' ? 'slice' : 'meet'}`,
    );
    if (fit === 'none') {
      const offset = (part: string, size: number) =>
        part === 'Min'
          ? '0px'
          : `calc(${part === 'Mid' ? 50 : 100}% - ${size * (part === 'Mid' ? 0.5 : 1)}px)`;
      svg.style.width = m.viewBox[2] + 'px';
      svg.style.height = m.viewBox[3] + 'px';
      svg.style.left = offset(x, m.viewBox[2]);
      svg.style.top = offset(y, m.viewBox[3]);
    } else svg.removeAttribute('style');
  }

  #order(): void {
    AnimaIcon.orderSVG?.(drawFrame(this.player!), this.#els);
  }

  #draw(all = false): void {
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
    if (button && !this.hasAttribute('tabindex')) this.tabIndex = 0;
    if (button) this.style.cursor ||= 'pointer';
    if (a?.pressed)
      set(
        a.role === 'switch' ? 'aria-checked' : 'aria-pressed',
        String(!!this.player!.get(a.pressed)),
      );
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
    }
    const states = JSON.stringify(p.states());
    if (states !== this.#states) {
      this.#states = states;
      AnimaIcon.eventHook?.(this, 'statechange', p.states());
      this.#aria();
      this.dispatchEvent(
        new CustomEvent('anima:state', { detail: p.states(), bubbles: true, composed: true }),
      );
    }
    if (settled) schedule(this, false);
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
    if (on && this.player?.busy) this.#wake();
    else if (!on) schedule(this, false);
  }

  #motion = (): void => {
    if (!this.player) return;
    const m = this.getAttribute('motion');
    this.player.reducedMotion = m === 'reduce' || (m !== 'full' && this.#query.matches);
    if (document.hidden) schedule(this, false);
    else if (this.player.busy) this.#wake();
  };

  // ------------------------------------------------------------ input

  #ptr(kind: 'move' | 'down' | 'up' | 'leave', e?: PointerEvent): void {
    const p = this.player;
    if (!p || (!this.#svg && !this.#renderer)) return;
    let x = 0;
    let y = 0;
    if (e) {
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
    this.#hold(down);
  }

  #hold(on: boolean): void {
    const a = this.player?.model.doc.a11y;
    if (a?.held && this.#held !== on) {
      this.#held = on;
      this.set(a.held, on);
    }
  }
}

if (!customElements.get('anima-icon')) customElements.define('anima-icon', AnimaIcon);

declare global {
  interface HTMLElementTagNameMap {
    'anima-icon': AnimaIcon;
  }
}
