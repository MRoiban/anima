import { focus, type FocusAPI } from '../core/index.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(focus);
Icon.prototype.focusNext = function () {
  return this.player?.focusTraverse('next') ?? false;
};
Icon.prototype.focusPrevious = function () {
  return this.player?.focusTraverse('previous') ?? false;
};
const attached = new WeakMap<AnimaIcon, () => void>();
function attach(icon: AnimaIcon) {
  attached.get(icon)?.();
  icon.setAttribute('data-focus-ready', '');
  const abort = new AbortController();
  let box: HTMLElement | undefined;
  let player = icon.player;
  let saved: FocusAPI['onFocusChange'];
  let refresh: FocusAPI['onFocusRefresh'];
  const listen = (type: string, fn: EventListener) =>
    icon.addEventListener(type, fn, { signal: abort.signal });
  // The host's accessibility update (load, state change) would hide the focus proxies again.
  const own = () => {
    if (box && !player?.model.doc.a11y) {
      icon.removeAttribute('aria-hidden');
      icon.setAttribute('role', 'group');
    }
  };
  const build = () => {
    box?.remove();
    box = undefined;
    if (player) {
      player.onFocusChange = saved;
      player.onFocusRefresh = refresh;
    }
    player = icon.player;
    if (!player?.model.doc.requires?.includes('focus')) return;
    const p = player,
      items = p.focusItems(true),
      inner = items.some((n) => n.config.tabStops);
    if (!items.length) return;
    box = document.createElement('span');
    box.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    const targets = new Map<string, HTMLElement>();
    for (const item of items) {
      const semantic = Icon.semanticElement?.(icon, item.id);
      const owner = item.owner ?? p;
      if (
        semantic === null &&
        owner.model.nodes[owner.model.ids.get(item.local ?? item.id)!]?.raw.a11y
      )
        continue;
      const el = semantic ?? document.createElement('span');
      if (!semantic || !inner) el.tabIndex = inner ? 0 : -1;
      if (!semantic) {
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', item.config.label ?? item.id);
        el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden';
        box.append(el);
      }
      el.dataset.focus = item.id;
      if (!semantic)
        el.onfocus = () => {
          p.focusTarget(item.id);
        };
      targets.set(item.id, el);
    }
    icon.shadowRoot!.append(box);
    own();
    if (inner) icon.removeAttribute('tabindex');
    else icon.tabIndex = 0;
    saved = p.onFocusChange;
    refresh = p.onFocusRefresh;
    p.onFocusRefresh = () => {
      refresh?.();
      const eligible = new Set(p.focusItems().map((n) => n.id));
      for (const [id, el] of targets) {
        const hidden = !eligible.has(id),
          tab = !hidden && (inner || p.focused === id) ? 0 : -1;
        if (el.hidden !== hidden) el.hidden = hidden;
        if (!(inner && el.dataset.semantic) && el.tabIndex !== tab) el.tabIndex = tab;
      }
    };
    p.onFocusRefresh();
    p.onFocusChange = (id) => {
      saved?.(id);
      for (const [name, el] of targets) el.tabIndex = inner || name === id ? 0 : -1;
      if (id) {
        if (inner) icon.removeAttribute('tabindex');
        else icon.tabIndex = -1;
        targets.get(id)?.focus({ preventScroll: true });
      } else if (icon.shadowRoot?.activeElement) {
        (icon.shadowRoot.activeElement as HTMLElement).blur();
      }
    };
    if (p.focused) p.onFocusChange(p.focused);
  };
  listen('anima:load', build);
  listen('anima:state', own);
  listen('anima:overlay', build);
  listen('pointerdown', (event) => {
    // seam(P6-6): native fields own pointer defaults while editing.
    if (
      icon.player?.focused &&
      !(event.composedPath()[0] as Element)?.hasAttribute?.('data-semantic')
    )
      event.preventDefault();
  });
  listen('focus', () => {
    const p = icon.player;
    if (p?.model.doc.requires?.includes('focus') && !icon.shadowRoot?.activeElement) {
      const id = p.focused ?? p.focusItems()[0]?.id;
      if (id) {
        if (!p.focusTarget(id))
          (icon.shadowRoot?.querySelector(`[data-focus="${id}"]`) as HTMLElement)?.focus();
      }
    }
  });
  listen('focusout', () =>
    queueMicrotask(() => {
      if (!icon.matches(':focus-within') && icon.player?.model.doc.requires?.includes('focus')) {
        icon.player.focusClear();
        if (!icon.player.focusItems(true).some((n) => n.config.tabStops)) icon.tabIndex = 0;
      }
    }),
  );
  listen('keydown', ((event: KeyboardEvent) => {
    if (!icon.player?.model.doc.requires?.includes('focus') || icon.hasAttribute('paused')) return;
    if (icon.player.model.doc.requires?.includes('input')) return;
    if ((event.composedPath()[0] as Element)?.hasAttribute?.('data-semantic')) return;
    if (
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      icon.player.focusKey(event.key, true, event.shiftKey)
    )
      event.preventDefault();
  }) as EventListener);
  build();
  attached.set(icon, () => {
    abort.abort();
    box?.remove();
    if (player) {
      player.onFocusChange = saved;
      player.onFocusRefresh = refresh;
    }
    attached.delete(icon);
  });
}
const load = Icon.prototype.load,
  destroy = Icon.prototype.destroy;
Icon.prototype.load = function (doc, markup = false) {
  if (!attached.has(this)) attach(this);
  return load.call(this, doc, markup);
};
Icon.prototype.destroy = function () {
  attached.get(this)?.();
  destroy.call(this);
};
for (const icon of document.querySelectorAll<AnimaIcon>('anima-icon')) attach(icon);

declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    focusNext(): boolean;
    focusPrevious(): boolean;
  }
}
