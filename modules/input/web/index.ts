import { input } from '../core/index.ts';
import type { InputController } from '../core/runtime.ts';
import type {
  GamepadRecord,
  PointerEventKind,
  PointerOptions,
  KeyOptions,
  ScrollOptions,
} from '../core/types.ts';
import { inputMatrix } from './mapping.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import type {} from '../../canvas/web/index.ts';
export { inputMatrix } from './mapping.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(input);
export interface InputOptions {
  listeners: boolean;
  multitouch: boolean;
  pointerExit: boolean;
  touchScroll: boolean;
  gamepads: boolean;
  requireFocus: boolean;
}
const defaults: InputOptions = {
  listeners: true,
  multitouch: true,
  pointerExit: true,
  touchScroll: true,
  gamepads: false,
  requireFocus: true,
};
const options = new WeakMap<AnimaIcon, InputOptions>();
const attached = new WeakMap<AnimaIcon, AbortController>();
const polling = new Set<AnimaIcon>();
let frame = 0;
const config = (i: AnimaIcon) => options.get(i) ?? defaults;
const active = (i: AnimaIcon) => i.player?.model.doc.requires?.includes('input');
function flush(i: AnimaIcon): void {
  if (!i.hasAttribute('paused')) {
    // Resuming uses the host's zero-time step/event path without advancing animation time.
    i.pause();
    i.play();
  }
  i.invalidate();
}
function point(i: AnimaIcon, x: number, y: number): DOMPoint {
  const svg = i.shadowRoot?.querySelector('svg');
  if (svg) {
    const m = svg.getScreenCTM();
    if (m) return new DOMPoint(x, y).matrixTransform(m.inverse());
  }
  if (!i.player) throw Error('anima: empty icon');
  // seam(P7-3): invert the drawn backend matrix, including before resize observation fires.
  const fitted = Icon.viewBox && Icon.canvasBox?.(i, [0, 0, 1, 1]);
  if (fitted) return new DOMPoint((x - fitted.x) / fitted.width, (y - fitted.y) / fitted.height);
  const canvas = i.shadowRoot?.querySelector('canvas');
  const rect = canvas?.getBoundingClientRect() ?? i.getBoundingClientRect();
  const width = canvas ? parseFloat(getComputedStyle(canvas).width) : rect.width;
  const height = canvas ? parseFloat(getComputedStyle(canvas).height) : rect.height;
  const m = inputMatrix(
    i.player.model.viewBox,
    width,
    height,
    i.getAttribute('fit') ?? 'contain',
    i.getAttribute('align') ?? 'center',
  );
  return new DOMPoint(
    ((x - rect.left) * width) / rect.width,
    ((y - rect.top) * height) / rect.height,
  ).matrixTransform(new DOMMatrix(m).inverse());
}
const cursorCSS = {
  arrow: 'default',
  hidden: 'none',
  pointer: 'pointer',
  'resize-horizontal': 'ew-resize',
  'resize-vertical': 'ns-resize',
  text: 'text',
};
function attach(i: AnimaIcon): void {
  if (attached.has(i) || !active(i)) return;
  const abort = new AbortController();
  attached.set(i, abort);
  const listen = (type: string, fn: EventListener, passive = false) =>
    i.addEventListener(type, fn, { capture: true, passive, signal: abort.signal });
  for (const [event, kind] of [
    ['pointermove', 'move'],
    ['pointerdown', 'down'],
    ['pointerup', 'up'],
    ['pointerleave', 'leave'],
    ['pointercancel', 'cancel'],
    ['lostpointercapture', 'cancel'],
  ] as const)
    listen(event, (e) => {
      if (!active(i)) return;
      const ev = e as PointerEvent,
        o = config(i),
        c = i.input();
      // The host's legacy route must not process this event a second time.
      Icon.inputEvents.add(e);
      if ((e.composedPath()[0] as Element).hasAttribute('data-semantic')) return;
      if (
        !o.listeners ||
        (!o.multitouch && ev.isPrimary === false) ||
        (!o.pointerExit && kind === 'leave')
      )
        return;
      const p =
        kind === 'leave' || kind === 'cancel' ? { x: 0, y: 0 } : point(i, ev.clientX, ev.clientY);
      c.pointer(kind, p.x, p.y, { id: ev.pointerId, button: ev.button < 0 ? 0 : ev.button });
      if (kind === 'down') {
        if (i.player?.focused) e.preventDefault();
        try {
          i.setPointerCapture(ev.pointerId);
        } catch {
          /* Synthetic/manual pointers are not active in the UA. */
        }
      }
      const intent = c.cursor;
      i.style.cursor = intent
        ? cursorCSS[intent]
        : i.player!.model.doc.a11y?.role === 'button'
          ? 'pointer'
          : '';
      flush(i);
    });
  for (const [type, kind] of [
    ['keydown', 'down'],
    ['keyup', 'up'],
  ] as const)
    listen(type, (e) => {
      // Semantic controls own their native keys before the drawn-input capture route.
      if (!active(i) || (e.composedPath()[0] as HTMLElement)?.hasAttribute('data-semantic')) return;
      if (!config(i).listeners) {
        // Disabled automatic input also keeps the host's Enter/Space route from handling it.
        Icon.inputEvents.add(e);
        return;
      }
      const k = e as KeyboardEvent;
      const handled = i.input().key(kind, k.key, {
        repeat: k.repeat,
        shift: k.shiftKey,
        control: k.ctrlKey,
        alt: k.altKey,
        meta: k.metaKey,
      });
      if (handled) {
        e.preventDefault();
      }
      // The existing Enter/Space accessibility handler remains in charge of native activation.
    });
  for (const type of ['keydown', 'keyup'])
    i.addEventListener(
      type,
      () => {
        if (active(i) && config(i).listeners) flush(i);
      },
      { signal: abort.signal },
    );
  listen('wheel', (e) => {
    if (!active(i)) return;
    if (!config(i).listeners) return;
    const w = e as WheelEvent,
      p = point(i, w.clientX, w.clientY);
    const unit = w.deltaMode === 1 ? 16 : w.deltaMode === 2 ? i.getBoundingClientRect().height : 1;
    const handled = i
      .input()
      .scroll(p.x, p.y, w.deltaX * unit, w.deltaY * unit, { time: performance.now() / 1000 });
    if (handled) {
      e.preventDefault();
      flush(i);
    }
  });
  i.style.touchAction = config(i).touchScroll ? 'pan-x pan-y' : 'none';
}
function poll(): void {
  frame = 0;
  for (const i of polling) {
    const o = config(i);
    if (!i.isConnected || !active(i) || !o.gamepads) {
      polling.delete(i);
      continue;
    }
    if (
      document.hidden ||
      (o.requireFocus && i !== document.activeElement && !i.contains(document.activeElement))
    )
      continue;
    const pads = Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p);
    const batch: GamepadRecord[] = pads.map((p) => ({
      index: p.index,
      connected: p.connected,
      mapping: p.mapping,
      axes: Array.from(p.axes),
      buttons: p.buttons.map((b) => ({ value: b.value, pressed: b.pressed })),
    }));
    for (const index of i.input().pads.keys())
      if (!batch.some((r) => r.index === index)) batch.push({ index, connected: false });
    i.input().gamepads(batch);
    flush(i);
  }
  if (polling.size) frame = requestAnimationFrame(poll);
}
const load = Icon.prototype.load,
  loadModel = Icon.prototype.loadModel,
  destroy = Icon.prototype.destroy;
Icon.prototype.loadModel = function (...args: Parameters<AnimaIcon['loadModel']>) {
  attached.get(this)?.abort();
  attached.delete(this);
  loadModel.apply(this, args);
  attach(this);
  later(this);
};
// Asset-backed loads create the player asynchronously; attach once it exists.
const later = (i: AnimaIcon) => {
  if (!attached.has(i)) i.addEventListener('anima:load', () => attach(i), { once: true });
};
Icon.prototype.load = function (...args: Parameters<AnimaIcon['load']>) {
  attached.get(this)?.abort();
  attached.delete(this);
  const result = load.apply(this, args);
  attach(this);
  later(this);
  return result;
};
Icon.prototype.destroy = function () {
  if (active(this)) this.input().cancel();
  attached.get(this)?.abort();
  attached.delete(this);
  polling.delete(this);
  if (!polling.size && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  destroy.call(this);
};
for (const [host, method] of [
  ['inputPointer', 'pointer'],
  ['inputKey', 'key'],
  ['inputScroll', 'scroll'],
  ['inputGamepads', 'gamepads'],
] as const)
  Object.defineProperty(Icon.prototype, host, {
    configurable: true,
    value: function (this: AnimaIcon, ...args: unknown[]) {
      const controller = this.input(),
        result = Reflect.apply(controller[method], controller, args);
      flush(this);
      return result;
    },
  });
Object.defineProperties(Icon.prototype, {
  input: {
    configurable: true,
    value: function (this: AnimaIcon): InputController {
      if (!this.player) throw Error('anima: empty icon');
      return this.player.input();
    },
  },
  inputPoint: {
    configurable: true,
    value: function (this: AnimaIcon, x: number, y: number) {
      return point(this, x, y);
    },
  },
  inputOptions: {
    configurable: true,
    get: function (this: AnimaIcon) {
      return { ...config(this) };
    },
    set: function (this: AnimaIcon, value: Partial<InputOptions>) {
      const next = { ...config(this), ...value };
      options.set(this, next);
      if (active(this)) {
        if (!next.listeners) this.input().cancel();
        attach(this);
      }
      this.style.touchAction = next.touchScroll ? 'pan-x pan-y' : 'none';
      if (next.gamepads) {
        polling.add(this);
        if (!frame) frame = requestAnimationFrame(poll);
      } else polling.delete(this);
    },
  },
});
for (const i of document.querySelectorAll<AnimaIcon>('anima-icon')) attach(i);
declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    input(): InputController;
    inputPoint(x: number, y: number): DOMPoint;
    get inputOptions(): InputOptions;
    set inputOptions(value: Partial<InputOptions>);
    inputPointer(kind: PointerEventKind, x?: number, y?: number, options?: PointerOptions): boolean;
    inputKey(kind: 'down' | 'up', key: string, options?: KeyOptions): boolean;
    inputScroll(x: number, y: number, dx: number, dy: number, options?: ScrollOptions): boolean;
    inputGamepads(batch: readonly GamepadRecord[]): void;
  }
}
