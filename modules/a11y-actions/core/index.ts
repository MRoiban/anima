import type { Player } from '../../../packages/core/src/player.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import { clamp } from '../../../packages/core/src/geom.ts';
import type { A11yConfig } from '../../a11y/core/types.ts';
const tapKey = (c: A11yConfig) =>
  c.activate ?? [c.checked, c.pressed, c.selected].find((v) => typeof v === 'string');
import type { a11y } from '../../a11y/core/index.ts';
import { after } from '../manifest.ts';
import { semanticDiff } from './diff.ts';
export { semanticDiff } from './diff.ts';
export * from '../../a11y/core/types.ts';
const pending = new WeakMap<Player, Map<string, number>>();
const installed = new WeakSet<object>();
const focusInstalled = new WeakSet<object>();
export const a11yActions: Module = {
  name: 'a11yactions',
  after,
  entries: [],
  init(modules, shared) {
    const base = modules.get('a11y') as typeof a11y | undefined;
    if (!base) return a11yActions;
    const runtime = base.runtime;
    runtime.version = modules.size;
    const { caches, flat } = runtime;
    runtime.update = (p, cache, old) => {
      const { entries, tree } = cache;
      const live = flat(tree),
        ancestry = new Set<string>();
      let at = entries.find((e) => e.id === p.focused);
      while (at) {
        ancestry.add(at.id);
        at = entries.find((e) => e.id === at!.parent);
      }
      for (const n of live) {
        const e = entries.find((e) => e.id === n.id)!,
          c = e.config!,
          d = e.data;
        if (!d.disabled) {
          const writable = (key: unknown) =>
            !d.readonly && typeof key === 'string' && !e.p.model.inputs.get(key)?.readonly;
          if (writable(tapKey(c))) n.actions.push('tap');
          if (c.role === 'slider' && writable(c.value)) n.actions.push('increase', 'decrease');
          if (e.p.focusItems?.().some((f) => f.id === e.p.model.nodes[e.i]!.id))
            n.actions.push('focus');
        }
        if (n.actions.includes('focus')) n.states.focused = ancestry.has(n.id);
      }
      const targets = live.filter((n) => n.actions.includes('focus'));
      if (p.focused && !targets.some((n) => n.id === p.focused)) {
        const previous = old?.entries ?? entries;
        let ancestor = previous.find((e) => e.id === p.focused);
        while (ancestor && !targets.some((n) => n.id === ancestor!.id))
          ancestor = previous.find((e) => e.id === ancestor!.parent);
        const order = previous.findIndex((e) => e.id === p.focused);
        const next =
          targets.find((n) => entries.findIndex((e) => e.id === n.id) > order) ?? targets[0];
        p.focusTarget?.(ancestor?.id ?? next?.id ?? null);
        return true;
      }
      return false;
    };
    const P = shared.Player;
    if (modules.has('focus') && !focusInstalled.has(P.prototype)) {
      focusInstalled.add(P.prototype);
      const items = P.prototype.focusItems;
      if (items)
        P.prototype.focusItems = function (all) {
          if (!caches.has(this) && this.model.doc.requires?.includes('a11y')) this.semantics();
          const cache = caches.get(this);
          return items
            .call(this, all)
            .filter(
              (n) =>
                all ||
                !cache?.entries.some(
                  (e) =>
                    e.id === n.id &&
                    e.config &&
                    (e.data.disabled || !flat(cache.tree).some((v) => v.id === n.id)),
                ),
            );
        };
      P.prototype.machineFocus = function (id) {
        return (
          this.focused === id ||
          (!!this.model.doc.requires?.includes('a11y') &&
            flat(this.semantics()).some((n) => n.id === id && n.states.focused))
        );
      };
    }
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
          const key = tapKey(c) as string;
          if (e.p.model.inputs.get(key)?.type === 'trigger') e.p.fire(key);
          else e.p.toggle(key);
        } else {
          const input = e.p.model.inputs.get(c.value!)!,
            key = input.name;
          const values = pending.get(e.p) ?? new Map<string, number>();
          pending.set(e.p, values);
          const range = (v: number) =>
            clamp(
              clamp(v + (action === 'increase' ? 1 : -1) * node.step!, node.min!, node.max!),
              input.min,
              input.max,
            );
          const from = values.get(key) ?? (e.p.get(key) as number),
            value = range(from);
          if (value === from) return false;
          values.set(key, value);
          // act queues the compiled ActionM payload; listener routing fields are not read.
          e.p.act({
            fire: [],
            toggle: [],
            set: [
              [
                key,
                () => {
                  values.delete(key);
                  return range(e.p.get(key) as number);
                },
              ],
            ],
          } as unknown as import('../../../packages/core/src/load.ts').ListenerM);
        }
        return true;
      };
    }
    return a11yActions;
  },
  resolve(model) {
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
