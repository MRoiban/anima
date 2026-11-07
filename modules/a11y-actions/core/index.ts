import type { Module } from '../../../packages/core/src/modules.ts';
import { clamp } from '../../../packages/core/src/geom.ts';
import type { A11yConfig } from '../../a11y/core/types.ts';
import type { a11y } from '../../a11y/core/index.ts';
import { after } from '../manifest.ts';
import { semanticDiff } from './diff.ts';
export { semanticDiff } from './diff.ts';
export * from '../../a11y/core/types.ts';
const installed = new WeakSet<object>();
export const a11yActions: Module = {
  name: 'a11yactions',
  after,
  entries: [],
  init(modules, shared) {
    const base = modules.get('a11y') as typeof a11y | undefined;
    if (!base) return a11yActions;
    const runtime = base.runtime;
    const { caches, flat, resolve } = runtime;
    runtime.update = (p, cache, old) => {
      const { entries, tree } = cache;
      for (const n of flat(tree)) {
        const e = entries.find((e) => e.id === n.id)!,
          c = e.config!,
          d = e.data;
        if (!d.disabled) {
          if (
            c.activate ||
            ['checked', 'pressed', 'selected'].some(
              (k) => typeof c[k as keyof A11yConfig] === 'string',
            )
          )
            n.actions.push('tap');
          if (c.role === 'slider') {
            if (!d.readonly) n.actions.push('increase', 'decrease');
          }
          if (e.p.focusItems?.().some((f) => f.id === e.p.model.nodes[e.i]!.id))
            n.actions.push('focus');
        }
        if (n.actions.includes('focus')) {
          const focused = p.focused;
          let at = entries.find((e) => e.id === focused);
          while (at && at.id !== e.id) at = entries.find((e) => e.id === at!.parent);
          n.states.focused = !!at;
        }
      }
      const live = flat(tree);
      if (p.focused && !live.some((n) => n.id === p.focused && n.actions.includes('focus'))) {
        const previous = old?.entries ?? entries;
        let ancestor = previous.find((e) => e.id === p.focused);
        while (ancestor && !live.some((n) => n.id === ancestor!.id && n.actions.includes('focus')))
          ancestor = previous.find((e) => e.id === ancestor!.parent);
        const order = previous.findIndex((e) => e.id === p.focused);
        const next =
          live.find(
            (n) => n.actions.includes('focus') && entries.findIndex((e) => e.id === n.id) > order,
          ) ?? live.find((n) => n.actions.includes('focus'));
        p.focusTarget?.(ancestor?.id ?? next?.id ?? null);
        return true;
      }
      return false;
    };
    const P = shared.Player;
    if (!installed.has(P.prototype)) {
      installed.add(P.prototype);
      P.prototype.semanticDiff = semanticDiff;
      P.prototype.semanticAction = function (id, action) {
        const node = flat(this.semantics()).find((n) => n.id === id);
        if (!node?.actions.includes(action)) return false;
        if (action === 'focus') return this.focusTarget?.(id) ?? false;
        const e = caches.get(this)!.entries.find((e) => e.id === id)!;
        const c = e.config!;
        if (action === 'tap') {
          if (c.readonly && resolve(e.p, c.readonly)) return false;
          const key =
            c.activate ?? [c.checked, c.pressed, c.selected].find((v) => typeof v === 'string');
          if (typeof key !== 'string') return false;
          if (e.p.model.inputs.get(key)?.type === 'trigger') e.p.fire(key);
          else e.p.set(key, !e.p.get(key));
        } else {
          const value = clamp(
            Number(node.value) + (action === 'increase' ? 1 : -1) * node.step!,
            node.min!,
            node.max!,
          );
          if (value === node.value) return false;
          e.p.set(c.value!, value);
        }
        return true;
      };
    }
    return { ...a11yActions, resolve: modules.has('focus') ? a11yActions.resolve : undefined };
  },
  resolve(model) {
    if (!model.nodes.some((n) => n.raw.a11y)) return;
    for (const n of model.nodes)
      if (
        n.raw.a11y &&
        'button checkbox switch radio slider tab link list-item'
          .split(' ')
          .includes(n.raw.a11y.role) &&
        !n.raw.focus
      )
        n.raw = { ...n.raw, focus: { tabStops: true, bounds: n.raw.a11y.bounds } };
  },
};
