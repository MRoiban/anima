import { registerEventKinds } from '../../components/core/events.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import type { ObjShape, Shape } from '../../../packages/core/src/registry.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { ListenerM } from '../../../packages/core/src/load.ts';
import { apply, invert, mul, IDENTITY, type Mat } from '../../../packages/core/src/geom.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { after } from '../manifest.ts';

export type Direction = 'next' | 'previous' | 'left' | 'right' | 'up' | 'down';
export interface FocusConfig {
  enabled?: boolean;
  enabledInput?: string;
  tabStops?: boolean;
  pointer?: boolean;
  order?: number;
  scope?: boolean;
  edge?: 'stop' | 'closed-loop' | 'parent-scope';
  label?: string;
  bounds?: [number, number, number, number];
}
export interface FocusItem {
  id: string;
  node: number;
  config: FocusConfig;
  owner?: Player;
  local?: string;
  point?: [number, number];
  matrix?: Mat;
  /** Paint order through nested owners: placement node, append sequence, inner rank. */
  rank?: number[];
}
export interface FocusAPI {
  readonly focused: string | null;
  focusTarget(id: string | null): boolean;
  focusClear(): boolean;
  focusTraverse(direction?: Direction): boolean;
  focusPointer(x: number, y: number, accept?: (node: number) => boolean): boolean;
  focusItems(includeDisabled?: boolean): FocusItem[];
  focusKey(key: string, down?: boolean, shift?: boolean): boolean;
  onFocusRefresh?: () => void;
  onFocusChange?: (id: string | null) => void;
}
declare module '../../../packages/core/src/player.ts' {
  interface Player extends FocusAPI {
    readonly focused: string | null;
  }
}
const state = new WeakMap<Player, string | null>();
const installed = new WeakSet<object>();
let pointerDepth = 0;
const str = (of?: string[]): Shape => ({ k: 'str', of });
const config: ObjShape = {
  k: 'obj',
  element: 'focus',
  p: {
    enabled: { k: 'bool' },
    enabledInput: { k: 'str', markup: 'enabled-input' },
    tabStops: { k: 'bool', markup: 'tab-stops' },
    pointer: { k: 'bool' },
    order: { k: 'num' },
    scope: { k: 'bool' },
    edge: str(['stop', 'closed-loop', 'parent-scope']),
    label: str(),
    bounds: {
      k: 'tup',
      min: 4,
      of: [{ k: 'num' }, { k: 'num' }, { k: 'num', min: 0 }, { k: 'num', min: 0 }],
    },
  },
};
const cfg = (p: Player, i: number): FocusConfig | undefined => p.model.nodes[i]!.raw.focus;
const eligible = (p: Player, i: number): boolean => {
  const f = cfg(p, i);
  if (!f || f.enabled === false || (f.enabledInput !== undefined && !p.get(f.enabledInput)))
    return false;
  return p.visible(i);
};
const scope = (p: Player, i: number): number => {
  for (let n = p.model.nodes[i]!.parent; n >= 0; n = p.model.nodes[n]!.parent)
    if (cfg(p, n)?.scope) return n;
  return -1;
};
const contains = (p: Player, ancestor: number, node: number): boolean => {
  while (node >= 0 && node !== ancestor) node = p.model.nodes[node]!.parent;
  return node === ancestor;
};
const point = (p: Player, i: number): [number, number] => {
  const [x, y, w, h] = cfg(p, i)?.bounds ?? [0, 0, 0, 0];
  return apply(p.world(i), x + w / 2, y + h / 2);
};
function install(P: typeof Player, modules: ReadonlyMap<string, Module>) {
  if (installed.has(P.prototype)) return;
  installed.add(P.prototype);
  Object.defineProperty(P.prototype, 'focused', {
    configurable: true,
    get(this: Player) {
      return state.get(this) ?? null;
    },
  });
  P.prototype.machineFocus = function (nodeId) {
    return this.focused === nodeId;
  };
  P.prototype.focusItems = function (this: Player, includeDisabled = false) {
    const items: FocusItem[] = this.model.nodes
      .flatMap((n, i) =>
        (includeDisabled ? !!cfg(this, i) : eligible(this, i))
          ? [{ id: n.id, node: i, config: cfg(this, i)! }]
          : [],
      )
      .sort((a, b) => (a.config.order ?? 0) - (b.config.order ?? 0) || a.node - b.node);
    let seq = 0;
    const append = (child: Player, name: string, node: number, matrix = this.world(node)) => {
      if (!includeDisabled && !this.visible(node)) return;
      seq++;
      for (const item of child.focusItems(includeDisabled))
        items.push({
          ...item,
          id: name + '.' + item.id,
          node,
          rank: [
            this.paintRank?.(node) ?? node,
            seq,
            ...(item.rank ?? [child.paintRank?.(item.node) ?? item.node]),
          ],
          matrix: mul(matrix, item.matrix ?? IDENTITY),
          owner: item.owner ?? child,
          local: item.local ?? item.id,
          point: apply(matrix, ...(item.point ?? point(child, item.node))),
        });
    };
    for (const [name, child] of (this.nested as unknown as { players?: Map<string, Player> })
      ?.players ?? [])
      append(child, name, this.model.ids.get(name)!);
    const lists = modules.get('lists') as
      typeof import('../../lists/core/index.ts').lists | undefined;
    for (const run of lists?.listState(this)?.runs ?? []) {
      const node = run.spec.node,
        raw = this.model.nodes[node]!.raw;
      for (const item of run.items)
        append(
          item.player,
          raw.id + '.' + item.index,
          node,
          mul(this.world(node), [
            1,
            0,
            0,
            1,
            (raw.dx ?? 0) * item.index,
            (raw.dy ?? 0) * item.index,
          ]),
        );
    }
    return items;
  };
  P.prototype.focusTarget = function (id) {
    const next = this.focusItems().find((n) => n.id === id);
    if (id !== null && !next) return false;
    const old = this.focused;
    if (old === id) return false;
    const previous = this.focusItems(true).find((n) => n.id === old);
    if (previous?.owner && previous.owner !== next?.owner) previous.owner.focusClear();
    if (next?.owner) next.owner.focusTarget(next.local!);
    state.set(this, id);
    for (const [on, target] of [
      ['blur', old],
      ['focus', id],
    ] as const)
      if (target !== null)
        for (const l of this.model.listeners)
          if (l.on === on && (l.target < 0 || this.model.nodes[l.target]!.id === target))
            this.act(l);
    this.onFocusChange?.(id);
    this.onChange?.();
    return true;
  };
  P.prototype.focusKey = function (key, down = true, shift = false) {
    const dirs: Record<string, Direction> = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down',
    };
    const dir =
      dirs[key] ??
      (key === 'Tab' && this.focusItems(true).some((n) => n.config.tabStops)
        ? shift
          ? 'previous'
          : 'next'
        : undefined);
    return down && dir ? this.focusTraverse(dir) : false;
  };
  P.prototype.focusClear = function () {
    return this.focusTarget(null);
  };
  P.prototype.focusTraverse = function (direction = 'next') {
    if (!['next', 'previous', 'left', 'right', 'up', 'down'].includes(direction))
      throw Error(V ? 'anima: invalid focus direction' : 'anima: focus');
    const all = this.focusItems(),
      current = all.find((n) => n.id === this.focused);
    const reverse = ['previous', 'left', 'up'].includes(direction);
    if (!current) return this.focusTarget((reverse ? all.at(-1) : all[0])?.id ?? null);
    if (current.owner) {
      if (current.owner.focusTraverse(direction))
        return this.focusTarget(
          current.id.slice(0, -current.local!.length) + current.owner.focused,
        );
      if (cfg(this, current.node)?.edge !== 'parent-scope') return false;
    }
    const sequential = direction === 'next' || direction === 'previous';
    let s = scope(this, current.node);
    const visited = new Set<number>();
    while (!visited.has(s)) {
      visited.add(s);
      const items = all.filter(
        (n) => scope(this, n.node) === s || (visited.size > 1 && contains(this, s, n.node)),
      );
      let next: FocusItem | undefined;
      if (sequential) {
        const at = items.indexOf(current);
        next = items[at + (reverse ? -1 : 1)];
      } else {
        const [x, y] = current.point ?? point(this, current.node);
        let best = Infinity;
        for (const n of items) {
          if (contains(this, n.node, this.model.nodes[current.node]!.parent)) continue;
          const [nx, ny] = n.point ?? point(this, n.node),
            dx = nx - x,
            dy = ny - y;
          const forward =
            direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
          const score = dx * dx + dy * dy;
          if (forward > 0 && score < best) {
            best = score;
            next = n;
          }
        }
      }
      if (next) return this.focusTarget(next.id);
      const edge = s < 0 ? 'stop' : (cfg(this, s)?.edge ?? 'stop');
      if (edge === 'stop') return false;
      if (edge === 'closed-loop') {
        if (sequential) next = reverse ? items.at(-1) : items[0];
        else {
          const axis = direction === 'left' || direction === 'right' ? 0 : 1;
          next = [...items].sort(
            (a, b) =>
              ((a.point ?? point(this, a.node))[axis] - (b.point ?? point(this, b.node))[axis]) *
                (reverse ? -1 : 1) || a.node - b.node,
          )[0];
        }
        return next ? this.focusTarget(next.id) : false;
      }
      s = scope(this, s);
    }
    return false;
  };
  P.prototype.focusPointer = function (x, y, accept) {
    const item = this.focusItems()
      .filter(
        (n) =>
          n.config.pointer !== false &&
          (!accept || accept(n.node)) &&
          (n.owner
            ? n.owner.focusItems().some((i) => i.id === n.local) &&
              (() => {
                const inv = invert(n.matrix!);
                return inv
                  ? n.owner!.hits(
                      { target: n.owner!.model.ids.get(n.local!)!, pad: 0 } as ListenerM,
                      ...apply(inv, x, y),
                    )
                  : false;
              })()
            : this.hits({ target: n.node, pad: 0 } as ListenerM, x, y)),
      )
      .sort((a, b) => {
        // Frontmost first, including paint order inside a component or list item.
        const r = a.rank ?? [this.paintRank?.(a.node) ?? a.node],
          q = b.rank ?? [this.paintRank?.(b.node) ?? b.node];
        for (let i = 0; i < r.length || i < q.length; i++)
          if ((q[i] ?? -1) !== (r[i] ?? -1)) return (q[i] ?? -1) - (r[i] ?? -1);
        return 0;
      })[0];
    return item ? this.focusTarget(item.id) : false;
  };
  const pointer = P.prototype.pointer,
    step = P.prototype.step;
  P.prototype.pointer = function (kind, x = 0, y = 0) {
    if (!pointerDepth && kind === 'down' && !this.model.doc.requires?.includes('input'))
      this.focusPointer(x, y);
    pointerDepth++;
    try {
      pointer.call(this, kind, x, y);
    } finally {
      pointerDepth--;
    }
  };
  P.prototype.step = function (...args) {
    const result = step.apply(this, args);
    if (this.focused && !this.focusItems().some((n) => n.id === this.focused)) {
      this.focusClear();
      result.settled = false;
    }
    this.onFocusRefresh?.();
    return result;
  };
}
export const focus: Module = {
  name: 'focus',
  after,
  entries: [
    {
      target: 'node',
      shapes: { focus: config },
      elements: {
        focus: {
          shape: config,
          target: { attribute: 'property', choices: ['focus'], default: 'focus' },
        },
      },
    },
  ],
  init(_modules, shared) {
    install(shared.Player, _modules);
    registerEventKinds(_modules, 'focus', ['focus', 'blur']);
    // The shared document registry always supplies object listeners.
    const listeners = (shared.DOC as ObjShape).p.listeners as Extract<Shape, { k: 'arr' }> & {
      of: ObjShape;
    };
    const shape = listeners.of;
    const on = shape.p.on!;
    return {
      ...focus,
      init: undefined,
      entries: [
        ...focus.entries,
        {
          target: 'document',
          shapes: {
            listeners: {
              ...listeners,
              feature: '',
              of: {
                ...shape,
                p: {
                  ...shape.p,
                  on: {
                    ...on,
                    re:
                      on.k === 'str' && on.re
                        ? new RegExp(on.re.source.replace('enter|', 'focus|blur|enter|'))
                        : undefined,
                    of: on.k === 'str' && on.of ? [...on.of, 'focus', 'blur'] : undefined,
                  } as Shape,
                },
              },
            },
          },
        },
      ],
    };
  },
  load(model, raw, d) {
    for (const [i, l] of (raw.listeners ?? []).entries())
      if (['focus', 'blur'].includes(l.on) && !raw.requires?.includes('focus'))
        d.err(
          'undeclared-feature',
          `/listeners/${i}/on`,
          V && 'focus listener requires focus',
          V && 'add "focus" to requires',
        );
    const paths = new Map<object, string>();
    const visit = (nodes: typeof raw.nodes, base: string) =>
      nodes.forEach((n: (typeof raw.nodes)[number], i: number) => {
        const p = base + '/' + i;
        paths.set(n, p);
        if (n.children) visit(n.children, p + '/children');
      });
    visit(raw.nodes, '/nodes');
    model.nodes.forEach((n) => {
      const f = n.raw.focus as FocusConfig | undefined;
      if (f?.enabledInput !== undefined) {
        const input = model.inputs.get(f.enabledInput),
          p = paths.get(n.raw) + '/focus/enabledInput';
        const warning = d.list.findIndex(
          (e) => e.code === 'unused-input' && e.pointer === '/inputs/' + f.enabledInput,
        );
        if (warning >= 0) d.list.splice(warning, 1);
        if (!input)
          d.err('unknown-input', p, V && 'unknown focus enabled input', V && 'name a bool input');
        else if (input.type !== 'bool')
          d.err('input-type', p, V && 'focus enabled input must be bool', V && 'name a bool input');
      }
    });
  },
};
