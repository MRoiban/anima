// <anima-icon>: the Anima web runtime (ARCHITECTURE §web). Retained SVG DOM built from the core's
// scene, one shared requestAnimationFrame loop that sleeps when every icon has settled, Pointer
// Events through the core's hit test, keyboard and ARIA per spec §10, CSS theming via slots.

import {
  type AnimaEvent,
  type Attrs,
  type Diagnostic,
  type El,
  type Model,
  Player,
  attrs,
  cssSlots,
  load,
  sceneTree,
} from '@anima-format/core';

export type { AnimaEvent, Diagnostic };

const SVG = 'http://www.w3.org/2000/svg';
const MAX_DT = 0.25;

// ---------------------------------------------------------------- shared scheduler

const active = new Set<AnimaIcon>();
let frame = 0;

function tick(now: number): void {
  frame = 0;
  for (const icon of active) icon.frame(now);
  if (active.size) frame = requestAnimationFrame(tick);
}

function schedule(icon: AnimaIcon, on: boolean): void {
  if (on) active.add(icon);
  else active.delete(icon);
  if (active.size && !frame) frame = requestAnimationFrame(tick);
}

let seen: IntersectionObserver | undefined;
const motionQuery = () => matchMedia('(prefers-reduced-motion: reduce)');

let ids = 0;

export class AnimaIcon extends HTMLElement {
  static observedAttributes = ['src', 'motion', 'label'];

  /** The player, once loaded (for debugging and tests). */
  player?: Player;
  /** Resolves when a document has loaded; rejects with its diagnostics. */
  ready: Promise<void>;
  /** Set to an array to record every step, pointer event and input write (for replays). */
  trace?: unknown[][];

  #resolve!: () => void;
  #reject!: (d: Diagnostic[]) => void;
  #root: ShadowRoot;
  #svg?: SVGSVGElement;
  #els: [El, Element, Attrs][] = [];
  #byNode = new Map<number, [El, Element, Attrs][]>();
  #last = -1;
  #onScreen = true;
  #states = '';
  #held = false;
  #mid = 'a' + ++ids + '-';

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.ready = new Promise((res, rej) => {
      this.#resolve = res;
      this.#reject = rej;
    });
    this.ready.catch(() => {});
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
      this.addEventListener(type, fn as EventListener);
  }

  connectedCallback(): void {
    if (!this.player) {
      const inline = this.querySelector('script[type="application/vnd.anima+json"]');
      if (inline) this.load(inline.textContent ?? '');
    }
    (seen ??= new IntersectionObserver((es) => {
      for (const e of es) (e.target as AnimaIcon).#visible(e.isIntersecting);
    })).observe(this);
    motionQuery().addEventListener('change', this.#motion);
    document.addEventListener('visibilitychange', this.#motion);
  }

  disconnectedCallback(): void {
    seen?.unobserve(this);
    motionQuery().removeEventListener('change', this.#motion);
    document.removeEventListener('visibilitychange', this.#motion);
    schedule(this, false);
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'src' && value)
      fetch(value)
        .then((r) => r.text())
        .then(
          (t) => this.load(t),
          () =>
            this.#fail([
              { code: 'fetch', severity: 'error', pointer: '', message: `cannot fetch ${value}` },
            ]),
        );
    else if (name === 'motion') this.#motion();
    else if (name === 'label') this.#aria();
  }

  /** Load a document (text or parsed). Returns its diagnostics; errors leave the icon empty. */
  load(doc: string | object): Diagnostic[] {
    const { model, diagnostics } = load(doc);
    if (!model) {
      this.#fail(diagnostics);
      return diagnostics;
    }
    this.player = new Player(model);
    this.#build(model);
    this.#motion();
    this.#aria();
    this.#step(0);
    this.#resolve();
    return diagnostics;
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

  #fail(d: Diagnostic[]): void {
    console.error(
      `anima-icon: cannot load (${d.map((x) => `${x.code} at ${x.pointer || '/'}`).join(', ')}); run anima validate for details`,
    );
    this.dispatchEvent(new CustomEvent('anima:error', { detail: d }));
    this.#reject(d);
  }

  // ------------------------------------------------------------ DOM

  #build(m: Model): void {
    const [x, y, w, h] = m.viewBox;
    const g = m.grid;
    const pct = (v: number) => (v / g) * 100 + '%';
    this.#root.innerHTML = `<style>:host{display:inline-block;position:relative;width:1em;height:1em;vertical-align:-.125em;touch-action:manipulation;-webkit-tap-highlight-color:transparent}svg{position:absolute;left:${pct(x)};top:${pct(y)};width:${pct(w)};height:${pct(h)};overflow:visible}</style>`;
    const svg = (this.#svg = document.createElementNS(SVG, 'svg'));
    svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    svg.setAttribute('aria-hidden', 'true');
    this.#els = [];
    this.#byNode.clear();
    const make = (el: El, parent: Element) => {
      const d = document.createElementNS(SVG, el.tag);
      parent.append(d);
      const rec: [El, Element, Attrs] = [el, d, {}];
      this.#els.push(rec);
      const list = this.#byNode.get(el.node) ?? [];
      list.push(rec);
      this.#byNode.set(el.node, list);
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
    for (const rec of this.#els) this.#paint(rec);
  }

  #paint(rec: [El, Element, Attrs]): void {
    const [el, d, cur] = rec;
    const next = attrs(this.player!, el, cssSlots, this.#mid);
    for (const k in next) {
      const v = next[k]!;
      if (v === cur[k]) continue;
      if (v === null) d.removeAttribute(k);
      else d.setAttribute(k, v);
      cur[k] = v;
    }
  }

  #draw(): void {
    const p = this.player!;
    const nodes = new Set(p.takeDirty().map((s) => p.model.addrs.get(p.addrs[s]!)!.node));
    // A visibility change reaches knockout cuts of descendants; just repaint everything then.
    if ([...nodes].some((n) => p.model.addrs.get(p.model.nodes[n]!.id + '.visible')))
      for (const rec of this.#els) this.#paint(rec);
    else for (const n of nodes) for (const rec of this.#byNode.get(n) ?? []) this.#paint(rec);
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
    for (const e of events)
      this.dispatchEvent(
        new CustomEvent('anima:event', { detail: e, bubbles: true, composed: true }),
      );
    const states = JSON.stringify(p.states());
    if (states !== this.#states) {
      this.#states = states;
      this.#aria();
      this.dispatchEvent(
        new CustomEvent('anima:state', { detail: p.states(), bubbles: true, composed: true }),
      );
    }
    if (settled) schedule(this, false);
  }

  /** Called by the shared loop. */
  frame(now: number): void {
    const dt = this.#last < 0 ? 0 : Math.min(MAX_DT, Math.max(0, (now - this.#last) / 1000));
    this.#last = now;
    this.#step(dt);
  }

  #wake(): void {
    if (!this.player || !this.#onScreen || document.hidden) return;
    if (!active.has(this)) this.#last = performance.now();
    schedule(this, true);
  }

  #visible(on: boolean): void {
    this.#onScreen = on;
    if (on && this.player?.busy) this.#wake();
    else if (!on) schedule(this, false);
  }

  #motion = (): void => {
    if (!this.player) return;
    const m = this.getAttribute('motion');
    this.player.reducedMotion = m === 'reduce' || (m !== 'full' && motionQuery().matches);
    if (document.hidden) schedule(this, false);
    else if (this.player.busy) this.#wake();
  };

  // ------------------------------------------------------------ input

  #ptr(kind: 'move' | 'down' | 'up' | 'leave', e?: PointerEvent): void {
    const p = this.player;
    if (!p || !this.#svg) return;
    let x = 0;
    let y = 0;
    if (e) {
      const m = this.#svg.getScreenCTM()?.inverse();
      if (!m) return;
      ({ x, y } = new DOMPoint(e.clientX, e.clientY).matrixTransform(m));
      if (kind === 'down') this.setPointerCapture?.(e.pointerId);
    }
    this.trace?.push(['pointer', kind, x, y]);
    p.pointer(kind, x, y);
    this.#step(0);
    this.#wake();
  }

  #key(e: KeyboardEvent, down: boolean): void {
    const a = this.player?.model.doc.a11y;
    if (!a || (a.role !== 'button' && a.role !== 'switch') || (e.key !== 'Enter' && e.key !== ' '))
      return;
    e.preventDefault();
    if (down && e.repeat) return;
    // Enter activates on key down, Space on key up — as native buttons do.
    if (a.activate && (e.key === 'Enter') === down) this.fire(a.activate);
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
