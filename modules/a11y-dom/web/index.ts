import '../../a11y-actions/web/index.ts';
import type { SemanticNode, SemanticAction } from '../../a11y/core/types.ts';
import type {} from '../../canvas/web/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
const trees = new WeakMap<AnimaIcon, SemanticNode[]>();
const roots = new WeakMap<AnimaIcon, () => void>();
const attached = new WeakMap<AnimaIcon, () => void>();
const roles: Record<string, string> = {
  'radio-group': 'radiogroup',
  'tab-list': 'tablist',
  'list-item': 'listitem',
  'alert-dialog': 'alertdialog',
};
Object.defineProperty(Icon.prototype, 'semantics', {
  get() {
    return structuredClone(this.player?.semantics() ?? []);
  },
});
Icon.prototype.semanticAction = function (id, action) {
  const changed = this.player?.semanticAction(id, action) ?? false;
  if (changed) {
    this.player!.step(0);
    this.invalidate();
    if (!this.hasAttribute('paused')) this.play();
  }
  return changed;
};
Icon.semanticElement = (icon, id) =>
  icon.getAttribute('a11y') !== 'off' && trees.has(icon)
    ? (icon.shadowRoot!.querySelector<HTMLElement>(`[data-semantic="${CSS.escape(id)}"]`) ?? null)
    : undefined;
function attach(icon: AnimaIcon) {
  attached.get(icon)?.();
  const p = icon.player;
  if (!p?.model.doc.requires?.includes('a11y')) return;
  let tree: SemanticNode[] = [],
    rendered: SemanticNode[] = [];
  const targets = new Map<string, HTMLElement>();
  const current = new Map<string, SemanticNode>();
  const box = document.createElement('span');
  box.style.cssText = 'position:absolute;inset:0;pointer-events:none;transform-origin:0 0';
  let transform = '';
  const style = document.createElement('style');
  style.textContent =
    'input{appearance:none;background:none}input::-webkit-slider-thumb{appearance:none;width:0;height:0}input::-moz-range-thumb,input::-moz-range-track{width:0;height:0;border:0;background:none}';
  icon.shadowRoot!.append(style, box);
  const layout = () => {
    const c = Icon.canvasBox?.(icon, [0, 0, 1, 1]);
    const m = c
        ? new DOMMatrix([c.width, 0, 0, c.height, c.x, c.y])
        : icon.shadowRoot!.querySelector('svg')?.getScreenCTM(),
      r = icon.getBoundingClientRect();
    if (m) {
      const next = `matrix(${m.a},${m.b},${m.c},${m.d},${m.e - r.x},${m.f - r.y})`;
      if (transform !== next) box.style.transform = transform = next;
    }
  };
  const update = () => {
    const next = p.semantics(),
      diff = p.semanticDiff(tree, next);
    tree = next;
    trees.set(icon, tree);
    const visible = icon.getAttribute('a11y') === 'off' ? [] : tree;
    const patch = p.semanticDiff(rendered, visible);
    rendered = visible;
    for (const id of patch.removed) {
      targets.get(id)?.remove();
      targets.delete(id);
      current.delete(id);
    }
    const dirty = new Set([...patch.added, ...patch.changed.map((n) => n.id)]);
    const moved = new Set(patch.changed.filter((n) => n.keys.includes('bounds')).map((n) => n.id));
    const walk = (
      nodes: SemanticNode[],
      parent: HTMLElement,
      origin = [0, 0],
      group = '',
      shift = false,
    ) => {
      for (const [i, n] of nodes.entries()) {
        current.set(n.id, n);
        let el = targets.get(n.id);
        if (dirty.has(n.id) || shift) {
          const tag =
            n.role === 'heading'
              ? 'h' + (n.level ?? 1)
              : ['button', 'switch', 'tab'].includes(n.role)
                ? 'button'
                : ['checkbox', 'radio', 'slider'].includes(n.role)
                  ? 'input'
                  : n.role === 'link'
                    ? 'a'
                    : 'div';
          if (!el || el.localName !== tag) {
            const old = el;
            el = document.createElement(tag);
            old?.replaceWith(el);
            targets.set(n.id, el);
            el.dataset.semantic = n.id;
            el.id = 'semantic-' + n.id;
            el.addEventListener('focus', () => icon.semanticAction(n.id, 'focus'));
            el.addEventListener(
              n.role === 'slider' ? 'input' : n.role === 'radio' ? 'change' : 'click',
              (event) => {
                if (
                  Icon.inputEvents.has(event) ||
                  (tag !== 'input' && !current.get(n.id)?.actions.includes('tap'))
                )
                  return;
                Icon.inputEvents.add(event);
                if (n.role === 'slider') {
                  const target = +(event.target as HTMLInputElement).value;
                  let value = Number(current.get(n.id)?.value);
                  while (value !== target) {
                    if (!icon.semanticAction(n.id, value < target ? 'increase' : 'decrease')) break;
                    const next = Number(current.get(n.id)?.value);
                    if (
                      !Number.isFinite(next) ||
                      next === value ||
                      (value < target !== next < target && next !== target)
                    )
                      break;
                    value = next;
                  }
                  (event.target as HTMLInputElement).value = String(
                    current.get(n.id)?.value ?? value,
                  );
                } else {
                  icon.semanticAction(n.id, 'tap');
                  const state = current.get(n.id)?.states ?? {};
                  (event.target as HTMLInputElement).checked = state.checked === true;
                  (event.target as HTMLInputElement).indeterminate = state.checked === 'mixed';
                }
              },
            );
          }
          el.setAttribute('role', roles[n.role] ?? n.role);
          for (const [key, value] of Object.entries({
            label: n.label,
            description: n.hint,
            controls: n.controls === undefined ? undefined : 'semantic-' + n.controls,
            valuemin: n.min,
            valuemax: n.max,
            valuenow: n.value === undefined || typeof n.value !== 'number' ? undefined : n.value,
            valuetext: n.valueText,
            ...n.states,
          })) {
            if (key === 'focused') continue;
            const attr = 'aria-' + key;
            if (value === undefined) el.removeAttribute(attr);
            else el.setAttribute(attr, String(value));
          }
          // Remove states that disappeared in the diff.
          for (const key of [
            'checked',
            'pressed',
            'selected',
            'expanded',
            'disabled',
            'required',
            'readonly',
            'modal',
            'live',
          ])
            if (!(key in n.states)) el.removeAttribute('aria-' + key);
          const input = el as HTMLInputElement;
          if (tag === 'input') {
            input.type = n.role === 'slider' ? 'range' : n.role;
            input.name = group;
            input.checked = n.states.checked === true;
            input.indeterminate = n.states.checked === 'mixed';
            for (const key of ['min', 'max', 'step'] as const) input[key] = String(n[key] ?? '');
            if (typeof n.value === 'number') input.value = String(n.value);
          }
          if (tag === 'a') (el as HTMLAnchorElement).href = n.href ?? '';
          input.disabled = !!n.states.disabled;
          if (!n.children.length && tag !== 'input') el.textContent = n.label ?? '';
          if (!el.dataset.focus || n.states.disabled)
            el.tabIndex = n.states.disabled
              ? -1
              : 'button switch checkbox radio slider link tab'.split(' ').includes(n.role)
                ? 0
                : -1;
          const [x, y, w, h] = n.bounds;
          el.style.cssText = `position:absolute;opacity:0;pointer-events:none;margin:0;padding:0;border:0;left:${x - origin[0]!}px;top:${y - origin[1]!}px;width:${w}px;height:${h}px`;
        }
        if (!el) continue;
        if (parent.children[i] !== el) parent.insertBefore(el, parent.children[i] ?? null);
        walk(n.children, el, n.bounds, n.role === 'radio-group' ? n.id : group, moved.has(n.id));
        if (['tab-list', 'radio-group'].includes(n.role)) {
          const radio = n.role === 'radio-group';
          const tabs = ([...el.children] as HTMLElement[]).filter(
            (t) =>
              t.getAttribute('role') === (radio ? 'radio' : 'tab') && t.ariaDisabled !== 'true',
          );
          const active =
            tabs.find((t) => t === icon.shadowRoot!.activeElement) ??
            tabs.find((t) => t.getAttribute(radio ? 'aria-checked' : 'aria-selected') === 'true') ??
            tabs[0];
          for (const t of tabs) {
            const index = t === active ? 0 : -1;
            if (t.tabIndex !== index) t.tabIndex = index;
          }
          el.onkeydown = (event) => {
            const key = event.key;
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key))
              return;
            event.preventDefault();
            const order = p.focusItems?.().map((n) => n.id);
            const enabled = tabs
              .filter((t) => t.getAttribute('aria-disabled') !== 'true')
              .sort((a, b) =>
                order ? order.indexOf(a.dataset.semantic!) - order.indexOf(b.dataset.semantic!) : 0,
              );
            const reverse = key === 'ArrowLeft' || key === 'ArrowUp';
            const at = enabled.indexOf(icon.shadowRoot!.activeElement as HTMLElement);
            const target =
              key === 'Home'
                ? enabled[0]
                : key === 'End'
                  ? enabled.at(-1)
                  : enabled[(at + (reverse ? -1 : 1) + enabled.length) % enabled.length];
            if (target) {
              target.focus();
              if (radio && target.getAttribute('aria-checked') !== 'true')
                icon.semanticAction(target.dataset.semantic!, 'tap');
              update();
            }
          };
        }
      }
    };
    walk(visible, box);
    layout();
    if (visible.length && !p.model.doc.a11y) {
      icon.removeAttribute('aria-hidden');
      if (icon.getAttribute('role') !== 'group') icon.setAttribute('role', 'group');
    }
    if (!visible.length && !p.model.doc.a11y && !p.model.doc.requires?.includes('focus')) {
      if (icon.getAttribute('aria-hidden') !== 'true') icon.setAttribute('aria-hidden', 'true');
      icon.removeAttribute('role');
    }
    if (
      patch.added.length ||
      patch.removed.length ||
      patch.changed.some((n) => n.keys.includes('role') || n.keys.includes('level'))
    )
      icon.dispatchEvent(new Event('anima:overlay'));
    if (diff.added.length || diff.removed.length || diff.changed.length)
      icon.dispatchEvent(new CustomEvent('anima:semantics', { detail: diff }));
  };
  roots.set(icon, () => {
    if (!box.isConnected) {
      icon.shadowRoot!.append(style, box);
      update();
    }
    if (Icon.viewBox) layout(); // seam(P7-3): only host-fit needs draw-time matrix refresh.
  });
  const step = p.step;
  p.step = function (...args) {
    const result = step.apply(this, args);
    update();
    return result;
  };
  box.addEventListener('focusin', update);
  const observer = new MutationObserver(update);
  observer.observe(icon, {
    attributes: true,
    // seam(P7-3): the canonical alignment attribute also moves semantic bounds.
    attributeFilter: ['a11y', 'aria-hidden', 'fit', 'align', 'alignment'],
  });
  const resize = new ResizeObserver(layout);
  resize.observe(icon);
  update();
  attached.set(icon, () => {
    observer.disconnect();
    resize.disconnect();
    p.step = step;
    box.remove();
    style.remove();
    trees.delete(icon);
    roots.delete(icon);
    attached.delete(icon);
  });
}
const loadModel = Icon.prototype.loadModel,
  destroy = Icon.prototype.destroy;
Icon.prototype.loadModel = function (model) {
  attached.get(this)?.();
  this.addEventListener('anima:load', () => attach(this), { once: true });
  loadModel.call(this, model);
};
Icon.prototype.destroy = function () {
  attached.get(this)?.();
  destroy.call(this);
};
for (const icon of document.querySelectorAll<AnimaIcon>('anima-icon')) attach(icon);
declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    readonly semantics: SemanticNode[];
    semanticAction(id: string, action: SemanticAction): boolean;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace AnimaIcon {
    let semanticElement: (icon: AnimaIcon, id: string) => HTMLElement | null | undefined;
  }
}

const previousEvent = Icon.eventHook;
Icon.eventHook = (icon, kind, detail) => {
  previousEvent?.(icon, kind, detail);
  if (kind === 'draw') roots.get(icon)?.();
};
