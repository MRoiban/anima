// Optional native toolbar/grid navigation; the base overlay retains tabs and radios.
import './index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import type { SemanticNode } from '../../a11y/core/types.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
const attached = new WeakMap<AnimaIcon, () => void>();
function attach(icon: AnimaIcon) {
  if (attached.has(icon)) return;
  const abort = new AbortController();
  const groups = new Set<HTMLElement>();
  const update = () => {
    for (const el of groups) el.onkeydown = null;
    groups.clear();
    const p = icon.player;
    if (!p) return;
    const root = icon.shadowRoot!;
    const element = (n: SemanticNode) =>
      root.querySelector<HTMLElement>(`[data-semantic="${CSS.escape(n.id)}"]`);
    const items = p.model.doc.requires?.includes('focus') ? p.focusItems?.() : undefined,
      configs = p.focusItems?.(true);
    const enabled = (n: SemanticNode) =>
      !n.states.disabled && (!items || items.some((i) => i.id === n.id));
    const walk = (nodes: SemanticNode[]) => {
      for (const n of nodes) {
        walk(n.children);
        if (!['toolbar', 'grid'].includes(n.role)) continue;
        const el = element(n);
        if (!el) continue;
        groups.add(el);
        const grid = n.role === 'grid';
        const rows = grid ? n.children.filter((r) => r.role === 'row') : [n];
        const cells = rows.map((r) =>
          r.children.filter((c) =>
            grid
              ? c.role === 'gridcell'
              : 'button switch checkbox radio slider tab link'.split(' ').includes(c.role),
          ),
        );
        if (!grid && items)
          cells[0]!.sort(
            (a, b) => items.findIndex((i) => i.id === a.id) - items.findIndex((i) => i.id === b.id),
          );
        const all = cells.flat(),
          available = all.filter(enabled);
        const active = available.find((c) => element(c) === root.activeElement) ?? available[0];
        for (const c of all) {
          const target = element(c);
          if (target) target.tabIndex = c === active ? 0 : -1;
        }
        el.onkeydown = (event) => {
          // A nested composite owns its keys. Modified shortcuts belong to the page,
          // except the grid's Ctrl+Home/End; PageUp/PageDown are always untouched.
          const key = event.key;
          if (
            (event.target as Element).closest('[role="toolbar"],[role="grid"]') !== el ||
            event.altKey ||
            event.metaKey ||
            event.shiftKey ||
            (event.ctrlKey && !(grid && (key === 'Home' || key === 'End'))) ||
            !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)
          )
            return;
          const current = all.find((c) => element(c) === root.activeElement);
          if (!current) return;
          const row = cells.findIndex((r) => r.includes(current));
          const column = cells[row]!.indexOf(current);
          const reverse = key === 'ArrowLeft' || key === 'ArrowUp';
          const line = grid && !event.ctrlKey ? cells[row]!.filter(enabled) : available;
          let target: SemanticNode | undefined;
          if (key === 'Home') target = line[0];
          else if (key === 'End') target = line.at(-1);
          else if (grid && (key === 'ArrowUp' || key === 'ArrowDown')) {
            target = cells[row + (reverse ? -1 : 1)]?.[column];
            if (target && !enabled(target)) target = undefined;
          } else {
            const index = line.indexOf(current) + (reverse ? -1 : 1);
            target = line[index];
            if (!target) {
              const edge = grid
                ? (configs?.find((i) => i.id === rows[row]!.id)?.config.edge ?? 'stop')
                : 'closed-loop';
              if (edge === 'closed-loop') target = reverse ? line.at(-1) : line[0];
              else if (edge === 'parent-scope' && p.focusTraverse?.(reverse ? 'left' : 'right'))
                icon.flush();
            }
          }
          // Boundary keys retain focus and suppress page scrolling, just like tabs.
          event.preventDefault();
          if (target) element(target)?.focus();
          update();
        };
      }
    };
    walk(p.semantics());
  };
  for (const kind of ['anima:load', 'anima:semantics', 'anima:overlay', 'focusin'])
    icon.addEventListener(kind, update, { signal: abort.signal });
  update();
  attached.set(icon, () => {
    abort.abort();
    for (const el of groups) el.onkeydown = null;
    attached.delete(icon);
  });
}
const load = Icon.prototype.loadModel,
  destroy = Icon.prototype.destroy;
Icon.prototype.loadModel = function (model) {
  attach(this);
  load.call(this, model);
};
Icon.prototype.destroy = function () {
  attached.get(this)?.();
  destroy.call(this);
};
for (const icon of document.querySelectorAll<AnimaIcon>('anima-icon')) attach(icon);
