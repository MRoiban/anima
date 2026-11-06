import { focus, type FocusAPI, type Direction } from '../core/index.ts';
import { focusMarkup } from '../markup/index.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(focus);
Icon.registerMarkup('paint', focusMarkup);
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
  const build = () => {
    box?.remove();
    if (player) {
      player.onFocusChange = saved;
      player.onFocusRefresh = refresh;
    }
    player = icon.player;
    if (!player?.model.doc.requires?.includes('focus')) return;
    const p = player,
      inner = p.focusItems(true).some((n) => n.config.tabStops);
    const items = p.focusItems(true);
    if (!items.length) return;
    box = document.createElement('span');
    box.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    const targets = new Map<string, HTMLElement>();
    for (const item of items) {
      const el = document.createElement('span');
      el.tabIndex = inner ? 0 : -1;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', item.config.label ?? item.id);
      el.dataset.focus = item.id;
      el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden';
      el.addEventListener('focus', () => p.focusTarget(item.id), { signal: abort.signal });
      targets.set(item.id, el);
      box.append(el);
    }
    icon.shadowRoot!.append(box);
    if (!p.model.doc.a11y) {
      icon.removeAttribute('aria-hidden');
      icon.setAttribute('role', 'group');
    }
    if (inner) icon.removeAttribute('tabindex');
    else icon.tabIndex = 0;
    saved = p.onFocusChange;
    refresh = p.onFocusRefresh;
    p.onFocusRefresh = () => {
      refresh?.();
      const eligible = new Set(p.focusItems().map((n) => n.id));
      for (const [id, el] of targets) {
        el.hidden = !eligible.has(id);
        el.tabIndex = eligible.has(id) && (inner || p.focused === id) ? 0 : -1;
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
  };
  listen('anima:load', build);
  listen('pointerdown', (event) => {
    if (icon.player?.focused) event.preventDefault();
  });
  listen('focus', () => {
    const p = icon.player;
    if (p?.model.doc.requires?.includes('focus') && !icon.shadowRoot?.activeElement) {
      const id = p.focused ?? p.focusItems()[0]?.id;
      if (id) {
        if (!p.focusTarget(id))
          (box?.querySelector(`[data-focus="${id}"]`) as HTMLElement)?.focus();
      }
    }
  });
  listen('focusout', () =>
    queueMicrotask(() => {
      if (!icon.matches(':focus-within') && icon.player?.model.doc.requires?.includes('focus')) {
        icon.player.focusClear();
        if (!icon.player.model.nodes.some((n) => n.raw.focus?.tabStops)) icon.tabIndex = 0;
      }
    }),
  );
  listen('keydown', ((event: KeyboardEvent) => {
    if (!icon.player?.model.doc.requires?.includes('focus') || icon.hasAttribute('paused')) return;
    const dirs: Record<string, Direction> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
    };
    const dir = dirs[event.key];
    if (dir && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      icon.player.focusTraverse(dir);
    }
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
