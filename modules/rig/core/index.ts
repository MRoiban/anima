import type { Module } from '../../../packages/core/src/modules.ts';
import { check } from '../../../packages/core/src/check.ts';
import type { Shape } from '../../../packages/core/src/registry.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { nodePointer } from '../../components/core/node-pointer.ts';
import { apply } from '../../../packages/core/src/geom.ts';
import {
  constraintKinds,
  registerConstraint,
  decompose,
  type Constraint,
  type RigContext,
} from './api.ts';
import { bone, pivot, install, contexts } from './solve.ts';
import { constraintElements } from '../markup/elements.ts';
import { number, origin, registerCopies } from './constraints.ts';
import { registerDistance } from './distance.ts';
import { after } from '../manifest.ts';
export * from './api.ts';
export { contexts, bone, pivot } from './solve.ts';
export interface RigModule extends Module {
  registerConstraint: typeof registerConstraint;
  kinds: typeof constraintKinds;
  origin: typeof origin;
  context(player: import('../../../packages/core/src/player.ts').Player): RigContext | undefined;
}
const shape: Shape = {
  k: 'alt',
  get of(): Shape[] {
    return [...constraintKinds.values()].map((c) => ({
      k: 'obj',
      p: { kind: { k: 'str', of: [c.kind] }, strength: number(0, 1), ...c.shape.p },
      req: ['kind', ...(c.shape.req ?? [])],
    }));
  },
};
const constraints: Shape = {
  k: 'arr',
  of: { k: 'any' },
  ...(V ? { schema: { k: 'arr' as const, of: shape } } : {}),
  element: 'constraint',
};
export const rig: RigModule = {
  name: 'rig',
  after,
  registerConstraint,
  kinds: constraintKinds,
  origin,
  context: (p) => contexts.get(p),
  entries: [
    {
      target: 'bone',
      node: {},
      shapes: { length: number(0), root: { k: 'bool' }, children: { k: 'arr', of: { k: 'node' } } },
      props: { length: { type: 'number', def: 0, min: 0 } },
    },
    { target: 'node', shapes: { constraints } },
  ],
  init(_registry, shared) {
    constraintKinds.clear();
    registerCopies();
    if (V) registerDistance();
    if (V)
      Object.defineProperty(rig.entries[1]!, 'elements', {
        configurable: true,
        get: () => constraintElements(constraintKinds),
      });
    const values = shared.Player.prototype.values;
    // Install once per constructor; contexts is the module instance of the active registry.
    if (!(shared.Player.prototype as unknown as { rigValues?: boolean }).rigValues) {
      (shared.Player.prototype as unknown as { rigValues?: boolean }).rigValues = true;
      shared.Player.prototype.values = function () {
        const out = values.call(this),
          ctx = contexts.get(this);
        if (ctx)
          for (const [i, n] of this.model.nodes.entries()) {
            const v = decompose(ctx.world(i), pivot(this.model, i));
            if (v[2] === Math.PI) v[2] = -Math.PI;
            ['x', 'y', 'rotate', 'scaleX', 'scaleY'].forEach(
              (key, k) => (out[n.id + '.world.' + key] = v[k]! * (k === 2 ? 180 / Math.PI : 1)),
            );
            if (bone(this.model, i)) {
              const tip = apply(ctx.world(i), this.num(i, 'length', 0), 0);
              out[n.id + '.tip.x'] = tip[0];
              out[n.id + '.tip.y'] = tip[1];
            }
          }
        return out;
      };
    }
    return rig;
  },
  model(n, key) {
    const match = /^constraints\.(0|[1-9]\d*)\.(\w+)$/.exec(key);
    if (!match) return;
    const raw = n.raw.constraints?.[+match[1]!],
      field = match[2]!;
    if (!raw) return;
    const s = field === 'strength' ? number(0, 1) : constraintKinds.get(raw?.kind)?.shape.p[field];
    if (s?.k !== 'num' && !(s?.k === 'tup' && field === 'origin')) return;
    return {
      prop: {
        type: s.k === 'num' ? 'number' : 'point',
        min: s.k === 'num' ? s.min : undefined,
        max: s.k === 'num' ? s.max : undefined,
        feature: 'rig',
      },
      rest:
        s.k === 'tup'
          ? (raw[field] ?? [0, 0])
          : (raw[field] ??
            s.default ??
            (field.startsWith('min')
              ? -Infinity
              : field.startsWith('max')
                ? Infinity
                : field === 'strength' || field.startsWith('factor')
                  ? 1
                  : 0)),
    } as ReturnType<NonNullable<Module['model']>>;
  },
  value(_addr, value, pointer, d) {
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        /* diagnosed below */
      }
    }
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      value.every((x) => typeof x === 'number' && Number.isFinite(x))
    )
      return value as [number, number];
    d.err('value-type', pointer, V && 'origin needs two finite numbers', V && 'use [u,v]');
  },
  prepare(model, d) {
    if (!model.doc.requires?.includes('rig')) return;
    for (const [i, n] of model.nodes.entries())
      for (const [k, r] of (n.raw.constraints ?? []).entries()) {
        const kind = constraintKinds.get(r?.kind);
        check(
          r,
          {
            ...kind?.shape,
            k: 'obj',
            p: {
              kind: { k: 'str', of: kind ? [kind.kind] : [...constraintKinds.keys()] },
              strength: number(0, 1),
              ...kind?.shape.p,
            },
            req: ['kind', ...(kind?.shape.req ?? [])],
          },
          nodePointer(model, i) + '/constraints/' + k,
          d,
          0,
        );
      }
  },
  load(model, _raw, d) {
    if (d.failed || !model.doc.requires?.includes('rig')) return;
    const edges = model.nodes.map(() => new Set<number>()),
      order: number[] = [];
    model.nodes.forEach((n, i) => {
      if (n.parent >= 0) edges[n.parent]!.add(i);
    });
    const reach = (from: number, to: number, seen = new Set<number>()): boolean => {
      if (from === to) return true;
      if (seen.has(from)) return false;
      seen.add(from);
      return [...edges[from]!].some((i) => reach(i, to, seen));
    };
    const link = (from: number, to: number, at: string) => {
      if (reach(to, from))
        d.err(
          'rig-cycle',
          at,
          V && 'constraint closes a dependency cycle',
          V && 'target a node outside the constrained subtree',
        );
      else edges[from]!.add(to);
    };
    for (const [i, n] of model.nodes.entries()) {
      const at = nodePointer(model, i);
      if (bone(model, i)) {
        for (let a = i; a >= 0; a = model.nodes[a]!.parent) {
          if (['scale', 'scaleX', 'scaleY'].some((k) => model.nodes[a]!.raw[k] === 0))
            d.err(
              'bad-value',
              at,
              V && 'bone rest frames must be invertible',
              V && 'use nonzero rest scales; animate collapse from a nonzero rest pose',
            );
        }
        if (n.raw.pivot !== undefined)
          d.err(
            'rig-bone-pivot',
            at + '/pivot',
            V && 'bones pivot at their start',
            V && 'remove pivot',
          );
        if (bone(model, n.parent) && !n.raw.root)
          for (const key of ['x', 'y'])
            if (n.raw[key] !== undefined || model.addrs.has(n.id + '.' + key))
              d.err(
                'rig-bone-offset',
                n.raw[key] === undefined ? at : at + '/' + key,
                V && 'a chained bone starts at its parent tip',
                V && 'remove x/y or set root=true',
              );
        if (n.parent >= 0 && !['group', 'bone'].includes(model.nodes[n.parent]!.type as string))
          d.err(
            'rig-bone-parent',
            at,
            V && 'bone parent cannot contain a chain',
            V && 'wrap the bones in a <group>',
          );
      }
      (n.raw.constraints ?? []).forEach((r: Constraint, k: number) => {
        const kind = constraintKinds.get(r.kind)!,
          pointer = at + '/constraints/' + k;
        if (
          r.kind === 'copyTransform' &&
          !origin.point &&
          (r.origin !== undefined || model.addrs.has(n.id + `.constraints.${k}.origin`))
        )
          d.err(
            'rig-origin',
            pointer + '/origin',
            V && 'transform origin support is not installed',
            V && 'import @anima-format/web/rig-origin',
          );
        for (const id of kind.targets(r, model)) {
          const j = model.ids.get(id);
          if (j === undefined)
            d.err(
              'rig-target',
              pointer,
              V && 'unknown constraint target ' + id,
              V && 'use an existing node id',
            );
          else link(j, i, pointer);
        }
        const writes = kind.writes?.(r, i, model) ?? [];
        for (const j of writes) {
          if (j !== i && !reach(i, j)) link(j, i, pointer);
          for (const child of model.nodes[j]?.children ?? [])
            if (child !== i && !writes.includes(child)) link(i, child, pointer);
        }
      });
    }
    const visited: boolean[] = [];
    const visit = (i: number) => {
      if (visited[i]) return;
      visited[i] = true;
      edges[i]!.forEach(visit);
      order.push(i);
    };
    edges.forEach((_, i) => visit(i));
    if (!d.failed) install(model, order.reverse());
  },
  draw: {
    tree(model, tree) {
      for (const [i] of model.nodes.entries()) if (bone(model, i)) tree.nodes[i]!.kind = 'group';
    },
  },
};
