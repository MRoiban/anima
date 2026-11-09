import { textinput, config } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import type { TextModule } from '../../text/core/index.ts';
import type { CanvasSourceHost } from '../../canvas/web/sources.ts';
import '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as CanvasSourceHost;
Icon.registerModule(textinput);
// Use the active registry: separate bundles may contain another copy of the module.
const { field, edit, select } = Icon.modules.get('textinput') as typeof textinput;
if (!Icon.prototype.textInput) {
  let previousOrder = Icon.orderSVG;
  const order: NonNullable<typeof Icon.orderSVG> = (frame, elements) => {
    previousOrder?.(frame, elements);
    for (const [el, dom] of elements)
      if (el.role === 'module:text')
        dom.setAttribute(
          'opacity',
          String((frame.nodes[el.node] as import('../core/index.ts').FieldNode).text?.opacity ?? 1),
        );
  };
  Object.defineProperty(Icon, 'orderSVG', {
    configurable: true,
    get: () => order,
    set: (next: typeof order) => {
      if (next !== order) previousOrder = next;
    },
  });
  const attached = new WeakMap<AnimaIcon, () => void>();
  const updates = new WeakMap<AnimaIcon, () => void>();
  const ranges = new WeakMap<Element, string>();
  const event = Icon.eventHook;
  Icon.eventHook = (icon, kind, info) => {
    event?.(icon, kind, info);
    if (kind === 'draw') updates.get(icon)?.();
  };
  const fields = new WeakMap<AnimaIcon, Map<string, HTMLInputElement | HTMLTextAreaElement>>();
  let semantic = Icon.semanticElement;
  const element: NonNullable<typeof Icon.semanticElement> = (icon, id) =>
    fields.get(icon)?.get(id) ?? semantic?.(icon, id);
  Object.defineProperty(Icon, 'semanticElement', {
    configurable: true,
    get: () => element,
    set: (next: typeof element) => {
      if (next !== element) semantic = next;
    },
  });
  function attach(icon: AnimaIcon) {
    attached.get(icon)?.();
    const p = icon.player;
    if (!p?.model.doc.requires?.includes('textinput')) return;
    const style = document.createElement('style');
    style.textContent =
      '::selection{background:transparent;color:transparent}::placeholder{color:transparent}div[role="text-field"]{display:none}';
    icon.shadowRoot!.append(style);
    const map = new Map<string, HTMLInputElement | HTMLTextAreaElement>();
    fields.set(icon, map);
    const abort = new AbortController();
    const wake = () => {
      icon.invalidate();
      if (!icon.hasAttribute('paused')) icon.play();
    };
    const layout = () => {
      if (!style.isConnected) icon.shadowRoot!.append(style);
      for (const el of map.values()) if (!el.isConnected) icon.shadowRoot!.append(el);
      const r = icon.getBoundingClientRect(),
        svg = icon.shadowRoot!.querySelector('svg');
      const canvas = Icon.canvasBox?.(icon, [0, 0, 1, 1]);
      const screen = canvas
        ? new DOMMatrix([canvas.width, 0, 0, canvas.height, canvas.x, canvas.y])
        : svg?.getScreenCTM();
      if (!screen) return;
      for (const [id, el] of map) {
        const i = p.model.ids.get(id)!;
        const m = new DOMMatrix([
          screen.a,
          screen.b,
          screen.c,
          screen.d,
          screen.e - r.x,
          screen.f - r.y,
        ]).multiply(new DOMMatrix(p.world(i)));
        el.style.transform = m.toString();
        // Animated or bound dimensions resize the native surface with the drawn field.
        el.style.width = p.prop(i, 'width') + 'px';
        el.style.height = p.prop(i, 'height') + 'px';
        const c = config(p, i)!;
        if (el instanceof HTMLInputElement) {
          const type = c.obscured ? 'password' : 'text';
          if (el.type !== type) {
            const start = el.selectionStart,
              end = el.selectionEnd,
              direction = el.selectionDirection;
            el.type = type;
            el.setSelectionRange(start, end, direction ?? undefined);
          }
        }
        const eligible = p.focusItems().some((n) => n.id === id);
        el.hidden = !eligible;
        el.readOnly = c.editable === false;
        const f = field(p, id)!,
          range = f.start + ',' + f.end;
        // Push core value or selection changes; a native selection in progress, or one already
        // matching (which may be backward), is left alone.
        if (
          !f.composing &&
          (el.value !== f.value ||
            (range !== ranges.get(el) &&
              (el.selectionStart !== f.start || el.selectionEnd !== f.end)))
        ) {
          if (el.value !== f.value) el.value = f.value;
          el.setSelectionRange(f.start, f.end);
        }
        ranges.set(el, range);
      }
    };
    for (const [i, n] of p.model.nodes.entries()) {
      const c = config(p, i);
      if (!c) continue;
      const el = document.createElement(c.multiline ? 'textarea' : 'input');
      if (el instanceof HTMLInputElement) el.type = c.obscured ? 'password' : 'text';
      el.dataset.semantic = n.id;
      el.dataset.focus = n.id;
      el.setAttribute('aria-label', c.label ?? c.placeholder ?? n.id);
      el.setAttribute('aria-multiline', String(!!c.multiline));
      el.placeholder = c.placeholder ?? '';
      el.autocomplete = 'off';
      if (c.maxLength !== undefined) el.maxLength = c.maxLength;
      el.value = field(p, n.id)!.value;
      const input = (Icon.modules.get('text') as TextModule).input(p, i);
      const s = input.styles[input.runs[0]?.style ?? ''] ?? {};
      el.style.cssText = `position:absolute;left:0;top:0;transform-origin:0 0;margin:0;padding:0;border:0;resize:none;background:transparent;color:transparent;caret-color:transparent;outline:0;box-sizing:border-box;`;
      el.style.font = `${s.style ?? 'normal'} ${s.weight ?? 400} ${s.size ?? 1}px/${n.raw.lineHeight || 1.2} ${s.font ?? 'sans-serif'}`;
      for (const name of ['copy', 'cut'])
        el.addEventListener(
          name,
          (e) => {
            if (config(p, i)?.obscured) e.preventDefault();
          },
          { signal: abort.signal },
        );
      const listen = (name: string, fn: EventListener) =>
        el.addEventListener(name, fn, { signal: abort.signal });
      listen('focus', () => {
        p.focusTarget(n.id);
        if (c.selectOnFocus) el.select();
        sync();
      });
      listen('blur', () => {
        if (p.focused === n.id) p.focusClear();
        wake();
      });
      const sync = () => {
        select(p, n.id, el.selectionStart ?? 0, el.selectionEnd ?? 0);
        wake();
      };
      const commit = (composing = false) => {
        const f = edit(p, n.id, el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0, composing)!;
        if (el.value !== f.value) {
          el.value = f.value;
          el.setSelectionRange(f.start, f.end);
        }
        wake();
      };
      listen('input', ((e: InputEvent) =>
        commit(e.isComposing || field(p, n.id)!.composing)) as EventListener);
      listen('compositionstart', () => {
        field(p, n.id)!.composing = true;
      });
      listen('compositionend', () => commit());
      for (const event of ['select', 'keyup', 'pointerup']) listen(event, sync);
      map.set(n.id, el);
      icon.shadowRoot!.append(el);
    }
    if (map.size) {
      icon.removeAttribute('aria-hidden');
      icon.setAttribute('role', 'group');
    }
    const observer = new MutationObserver(layout);
    observer.observe(icon.shadowRoot!, { childList: true });
    const resize = new ResizeObserver(layout);
    resize.observe(icon);
    updates.set(icon, layout);
    layout();
    icon.dispatchEvent(new Event('anima:overlay'));
    attached.set(icon, () => {
      abort.abort();
      resize.disconnect();
      observer.disconnect();
      updates.delete(icon);
      for (const el of map.values()) el.remove();
      style.remove();
      fields.delete(icon);
      attached.delete(icon);
    });
  }
  const hooked = new WeakSet<AnimaIcon>();
  const load = Icon.prototype.loadModel,
    destroy = Icon.prototype.destroy;
  Icon.prototype.loadModel = function (model) {
    attached.get(this)?.();
    // One persistent listener per icon: a failing load never fires `anima:load` (P4 R3-02 class).
    if (!hooked.has(this)) {
      hooked.add(this);
      this.addEventListener('anima:load', () => attach(this));
    }
    load.call(this, model);
  };
  Icon.prototype.destroy = function () {
    attached.get(this)?.();
    destroy.call(this);
  };
  Icon.prototype.textInput = function (id) {
    return fields.get(this)?.get(id);
  };
  for (const icon of document.querySelectorAll<AnimaIcon>('anima-icon')) attach(icon);
}
declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    textInput(id: string): HTMLInputElement | HTMLTextAreaElement | undefined;
  }
}
