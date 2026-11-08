import { componentNames } from './names.ts';
export { componentNames } from './names.ts';
import { nodePointer } from './node-pointer.ts';
import { formatHex } from '../../../packages/core/src/color.ts';
import type { EventModule, EventKinds } from './events.ts';
import { after } from '../manifest.ts';
import type { Module, ModuleRegistry } from '../../../packages/core/src/modules.ts';
import type { Model, NodeM, InputEvaluator } from '../../../packages/core/src/load.ts';
import type { Player, PlayerExtension } from '../../../packages/core/src/player.ts';
import type { ObjShape, NodeType, Shape } from '../../../packages/core/src/registry.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { apply, invert, mul, type Mat } from '../../../packages/core/src/geom.ts';
import { drawFrame, drawTree, drawWorld, type DrawNode } from '../../../packages/core/src/draw.ts';

declare module '../../../packages/core/src/load.ts' {
  interface Model {
    inheritedData?: boolean;
  }
}
interface Instance {
  node: number;
  model: Model;
  inputs: Map<string, InputEvaluator>;
  reads: Set<string>;
  offset: number;
}
interface Info {
  events: Set<string>;
  instances: Instance[];
  count: number;
  depth: number;
}
const info = new WeakMap<Model, Info>();
export type ComponentModule = EventModule & {
  placements: WeakMap<NodeM, Map<string, Model>>;
  // seam(P7-5): validated component models for cross-document values.
  catalog: WeakMap<Model, Map<string, Model>>;
  selected?: (parent: Player, node: NodeM) => boolean;
  choices?: (model: Model, node: NodeM) => string[] | undefined;
  configure?: (parent: Player, child: Player, node: NodeM) => void;
  matrix?: (parent: Player, child: Player, node: NodeM) => Mat;
  externalDrawing?: (model: Model) => boolean;
  forkModel: (source: Model, target: Model) => void;
  placementContext?: (model: Model, node: NodeM, key?: string) => string | undefined;
  componentKey?: (model: Model, name: string) => string;
  loadComponent?: (
    parent: Model,
    name: string,
    doc: Model['doc'],
    inherited: boolean,
    run: (doc: Model['doc']) => ReturnType<ModuleRegistry['load']>,
    itemModel?: string,
  ) => ReturnType<ModuleRegistry['load']>;
};
const placements = new WeakMap<NodeM, Map<string, Model>>();
// seam(P7-5): lexical catalogs never contain player state.
const catalog = new WeakMap<Model, Map<string, Model>>();
// Synchronous loader context: definitions are lexical to the enclosing document, never global.
interface Context {
  definitions: Model['doc'];
  cache: Map<string, Model | undefined>;
  stack: Set<string>;
  requires: string[];
  data?: Model['doc'];
  used: Set<string>;
}
let context: Context | undefined;
let active: ComponentModule | undefined;
const scoped = /^[a-z][a-zA-Z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)*$/;

function create(
  runtime: Pick<ModuleRegistry, 'load' | 'Player' | 'DOC' | 'nodeShape' | 'inputExpression'>,
  eventKinds: EventKinds = new Map(
    ['enter', 'leave', 'down', 'up', 'click', 'move'].map((name) => [name, undefined]),
  ),
): ComponentModule {
  return {
    eventKinds,
    placements,
    catalog,
    forkModel(source, target) {
      const i = info.get(source);
      if (i) info.set(target, i);
      target.inheritedData = source.inheritedData;
      // seam(P7-5): dynamic player models retain their lexical component catalog.
      const models = catalog.get(source);
      if (models) catalog.set(target, models);
    },
    name: 'components',
    after,
    init(_modules, shared) {
      const listener = (
        (shared.DOC as ObjShape).p.listeners as Extract<
          import('../../../packages/core/src/registry.ts').Shape,
          { k: 'arr' }
        >
      ).of as ObjShape;
      listener.p.on = {
        k: 'str',
        re: /^(?:enter|leave|down|up|click|move|[a-z][a-zA-Z0-9-]*(?:\.[a-z][a-zA-Z0-9-]*)+)$/,
      };
      listener.p.fire = listener.p.toggle = {
        k: 'alt',
        of: [
          { k: 'str', re: scoped },
          { k: 'arr', of: { k: 'str', re: scoped }, min: 1 },
        ],
      };
      listener.p.set = {
        k: 'map',
        key: scoped,
        of: (listener.p.set as Extract<Shape, { k: 'map' }>).of,
      };
      // Preserve composed kinds when AniML replays a module into its isolated registry.
      return (active = create(shared, new Map(eventKinds)));
    },
    entries: [
      {
        target: 'document',
        shapes: {
          components: {
            k: 'map',
            key: /^[a-z][a-zA-Z0-9-]*(?::[a-z][a-zA-Z0-9-]*)*$/,
            of: { k: 'any', format: runtime.DOC },
          },
        },
      },
      {
        target: 'instance',
        node: {},
        shapes: {
          component: { k: 'str', re: /^[a-z][a-zA-Z0-9-]*(?::[a-z][a-zA-Z0-9-]*)*$/ },
          inputs: {
            k: 'map',
            element: 'instance-inputs',
            key: (runtime.nodeShape('group').p.id as Extract<Shape, { k: 'str' }>).re!,
            of: { k: 'alt', of: [{ k: 'num' }, { k: 'bool' }, { k: 'str' }] },
          },
          speed: { k: 'num', min: 0 },
          paused: { k: 'bool' },
        },
        required: ['id', 'type', 'component'],
      },
    ],
    resolve(model, diag) {
      const local = (value: string) =>
        value.split('|').every((on) => {
          const kind = on.startsWith('event:')
            ? 'event:'
            : on.startsWith('change:')
              ? 'change:'
              : on;
          return (
            eventKinds.has(kind) &&
            (!eventKinds.get(kind) || model.doc.requires?.includes(eventKinds.get(kind)))
          );
        });
      if (!model.doc.requires?.includes('components')) {
        for (const [i, l] of (model.doc.listeners ?? []).entries())
          if (l.on.includes('.') && !local(l.on))
            diag.err(
              'undeclared-feature',
              '/listeners/' + i + '/on',
              V && 'instance event listeners require components',
              V && 'add "components" to "requires"',
            );
        return;
      }
      const outer = context;
      const ctx = (context ??= {
        definitions: model.doc.components ?? {},
        cache: new Map(),
        stack: new Set(),
        requires: model.doc.requires,
        data: model.doc.data,
        used: new Set(),
      });
      // seam(P7-5): retain both placed and validated unused components.
      const models = new Map<string, Model>();
      catalog.set(model, models);
      const data: Info = { events: new Set(), instances: [], count: 0, depth: 0 };
      info.set(model, data);
      const err = (code: string, pointer: string, message: string) =>
        diag.err(
          code,
          pointer,
          V && message,
          V &&
            (code === 'undeclared-feature'
              ? 'add "bind" to "requires"'
              : 'check the component declaration and its input types'),
        );
      const component = (name: string, pointer: string, itemModel?: string): Model | undefined => {
        const matches = componentNames({ ...model.doc, components: ctx.definitions }, name);
        if (matches.length > 1) {
          diag.err(
            'ambiguous-component',
            pointer,
            V && `ambiguous component "${name}"`,
            V && `use ${matches.join(' or ')}`,
          );
          return;
        }
        name = matches[0] ?? name;
        if (ctx.stack.has(name)) {
          err('component-cycle', pointer, 'recursive component reference');
          return;
        }
        const key = (active?.componentKey?.(model, name) ?? name) + ':' + (itemModel ?? '');
        ctx.used.add(name);
        if (ctx.cache.has(key)) {
          const child = ctx.cache.get(key);
          if (child) models.set(name, child);
          return child;
        }
        if (!Object.hasOwn(ctx.definitions, name) || name === '$comment') {
          err('unknown-component', pointer, `no component "${name}"`);
          return;
        }
        if (ctx.stack.size >= 8) {
          err('limit-exceeded', pointer, 'component nesting exceeds 8');
          return;
        }
        const def = ctx.definitions[name];
        if (!def || typeof def !== 'object' || Array.isArray(def)) {
          err('type', ptr('/components', name), 'a component is a nested document');
          return;
        }
        for (const key of ['anima', 'name', 'requires', 'components', 'title', 'meta', '$schema'])
          if (Object.hasOwn(def, key))
            err(
              'unknown-key',
              ptr(ptr('/components', name), key),
              `component definitions take no ${key} wrapper`,
            );
        const reserved = runtime.nodeShape('instance' as NodeType).p;
        for (const input of Object.keys(def.inputs ?? {}))
          if (Object.hasOwn(reserved, input))
            diag.err(
              'reserved-input-name',
              ptr(ptr(ptr('/components', name), 'inputs'), input),
              V && `input "${input}" is an instance property`,
              V && `rename the input; ${input} is an instance property (e.g. use pos-x)`,
            );
        ctx.stack.add(name);
        const document = {
          anima: '0.1',
          name: 'component',
          requires: ctx.requires,
          components: ctx.definitions,
          ...(model.doc.meta ? { meta: model.doc.meta } : {}),
          ...def,
          ...(ctx.data || def.data
            ? {
                data:
                  typeof def.data === 'string'
                    ? { ...ctx.data, model: def.data }
                    : (def.data ?? ctx.data),
              }
            : {}),
        };
        const hook = active?.loadComponent;
        const result = hook
          ? hook(model, name, document, !def.data, runtime.load, itemModel)
          : runtime.load(document);
        ctx.stack.delete(name);
        if (result.model && !def.data) result.model.inheritedData = true;
        for (const d of result.diagnostics)
          diag.list.push({
            ...d,
            pointer: d.pointer.startsWith('/components/')
              ? d.pointer
              : ptr('/components', name) + d.pointer,
          });
        ctx.cache.set(key, result.model);
        if (result.model) models.set(name, result.model);
        return result.model;
      };
      try {
        model.nodes.forEach((node, ni) => {
          if ((node.type as string) === 'repeat') {
            const choices = new Map<string, Model>();
            placements.set(node, choices);
            for (const [key, name] of typeof node.raw.component === 'string'
              ? [['*', node.raw.component]]
              : Object.entries(node.raw.component ?? {}))
              if (key !== '$comment') {
                const child = component(
                  String(name),
                  nodePointer(model, ni) + '/component',
                  active?.placementContext?.(model, node, key),
                );
                if (child) choices.set(key, child);
              }
            return;
          }
          if ((node.type as string) !== 'instance') return;
          const pointer = nodePointer(model, ni);
          const names = active?.choices?.(model, node) ?? [node.raw.component];
          const choices = new Map<string, Model>();
          for (const name of names) {
            // seam(P7-5): a dynamic choice cannot recursively instantiate an ancestor.
            if (node.raw.component.startsWith('$') && ctx.stack.has(name)) continue;
            const child = component(
              name,
              pointer + '/component',
              active?.placementContext?.(model, node),
            );
            if (child) choices.set(name, child);
          }
          const child = choices.values().next().value;
          if (!child) return;
          placements.set(node, new Map([['*', child], ...choices]));
          const entry: Instance = {
            node: ni,
            model: child,
            inputs: new Map(),
            reads: new Set(),
            offset: 0,
          };
          data.instances.push(entry);
          const nested = [...choices.values()].map((m) => info.get(m));
          data.count += 1 + Math.max(...nested.map((i) => i?.count ?? 0));
          data.depth = Math.max(data.depth, 1 + Math.max(...nested.map((i) => i?.depth ?? 0)));
          for (const [name, value] of Object.entries(node.raw.inputs ?? {})) {
            if (name === '$comment') continue;
            const p = ptr(pointer + '/inputs', name),
              input = child.inputs.get(name);
            if (!input) {
              err('unknown-input', p, `no component input "${name}"`);
              continue;
            }
            if (typeof value === 'string') {
              if (!model.doc.requires.includes('bind')) {
                err('undeclared-feature', p, 'instance expressions require bind');
                continue;
              }
              if (!/^\{[\s\S]+\}$/.test(value)) {
                err('bind-syntax', p, 'use {expression}');
                continue;
              }
              const e = runtime.inputExpression(
                model,
                value.slice(1, -1),
                input.type,
                p,
                diag,
                (n) => entry.reads.add(n),
              );
              if (e) entry.inputs.set(name, e);
            } else if (
              input.type === 'trigger' ||
              typeof value !== (input.type === 'bool' ? 'boolean' : 'number')
            )
              err('input-type', p, 'instance input type mismatch');
          }
          for (const child of new Set(choices.values())) {
            // The child model distinguishes its authored inputs from bubbled event triggers.
            const events = new Set([
              ...(info.get(child)?.events ?? []),
              ...(child.eventNames ?? []),
            ]);
            for (const [name, input] of child.inputs)
              if (!events.has(name)) {
                const address = node.id + '.' + name,
                  previous = model.inputs.get(address);
                if (previous && previous.type !== input.type)
                  err(
                    'component-input-type',
                    pointer + '/component',
                    'component choices share an input with different types',
                  );
                model.inputs.set(address, { ...input, name: address });
              }
            for (const name of events) {
              const address = node.id + '.' + name;
              if (
                Object.hasOwn(child.doc.inputs ?? {}, name) ||
                (model.inputs.has(address) && model.inputs.get(address)!.type !== 'trigger')
              ) {
                err('component-event-collision', pointer, 'event and input share a scoped address');
                continue;
              }
              model.inputs.set(address, {
                name: address,
                type: 'trigger',
                def: false,
                min: 0,
                max: 1,
                buffer: 0,
              });
            }
          }
        });
        // Validate unused definitions after placements establish their inherited contexts.
        if (!outer)
          for (const name of Object.keys(ctx.definitions))
            if (name !== '$comment' && !ctx.used.has(name))
              component(name, ptr('/components', name));
        if (data.count > 256 || data.depth > 8)
          err('limit-exceeded', '/nodes', 'components exceed depth 8 or 256 expanded instances');
        if (data.instances.length) model.nesting = (p) => nest(p, data, runtime.Player);
        for (const [i, l] of (model.doc.listeners ?? []).entries())
          if (!local(l.on) && (!l.on.includes('.') || model.inputs.get(l.on)?.type !== 'trigger'))
            err('unknown-event', '/listeners/' + i + '/on', 'unknown instance event');
      } finally {
        context = outer;
      }
    },
    model(node, key) {
      const inputs = [...(placements.get(node)?.values() ?? [])].flatMap(
          (m) => m.inputs.get(key) ?? [],
        ),
        input = inputs[0];
      if (input && input.type !== 'trigger')
        return {
          prop: {
            type: input.type,
            feature: 'components',
            min: Math.min(...inputs.map((i) => i.min)),
            max: Math.max(...inputs.map((i) => i.max)),
          },
          rest: input.def,
        };
    },
    load(model, _raw, diag) {
      const data = info.get(model);
      if (data) {
        for (const l of model.layers) for (const s of l.states) if (s.emit) data.events.add(s.emit);
        for (const t of model.timelines) for (const [, name] of t.events) data.events.add(name);
        for (const l of model.listeners) if (l.emit) data.events.add(l.emit);
        for (const i of data.instances)
          for (const name of new Set([
            ...(info.get(i.model)?.events ?? []),
            ...(i.model.eventNames ?? []),
          ]))
            data.events.add(model.nodes[i.node]!.id + '.' + name);
      }
      // Proxy inputs and instance expressions are real uses, not unused declarations.
      const used = new Set(info.get(model)?.instances.flatMap((i) => [...i.reads]));
      for (let i = diag.list.length - 1; i >= 0; i--)
        if (
          diag.list[i]!.code === 'unused-input' &&
          [...model.inputs.keys()].some(
            (n) => (n.includes('.') || used.has(n)) && diag.list[i]!.pointer === ptr('/inputs', n),
          )
        )
          diag.list.splice(i, 1);
    },
    draw: {
      tree(model, tree) {
        if (active?.externalDrawing?.(model)) return;
        for (const i of info.get(model)?.instances ?? []) {
          const child = drawTree(i.model),
            offset = (i.offset = tree.nodes.length);
          const shift = (n: number) => n + offset;
          const group = tree.nodes[i.node]!;
          group.kind = 'group';
          group.children = child.roots.map(shift);
          for (const e of child.nodes)
            tree.nodes.push({
              ...e,
              id: model.nodes[i.node]!.id + '/' + (e.id ?? i.model.nodes[e.node]!.id),
              node: shift(e.node),
              parent: e.parent < 0 ? i.node : shift(e.parent),
              children: e.children.map(shift),
              dependencies: undefined,
              mask: e.mask ? { ...e.mask, source: shift(e.mask.source) } : undefined,
              clip: e.clip ? { ...e.clip, source: shift(e.clip.source) } : undefined,
            });
          for (const r of child.resources)
            tree.resources.push({
              ...r,
              node: shift(r.node),
              source: r.source === undefined ? undefined : shift(r.source),
            });
        }
      },
      end(p, frame) {
        if (active?.externalDrawing?.(p.model)) return;
        for (const i of info.get(p.model)?.instances ?? []) {
          const node = i.node;
          const child = (p.nested as Nested).players.get(p.model.nodes[node]!.id)!;
          const f = drawFrame(child),
            world = p.world(node);
          f.nodes.forEach((n, index) => {
            const shift = (v: number) => v + i.offset;
            const data: DrawNode = {
              ...n,
              world: n.world ? mul(world, n.world) : undefined,
              mask: n.mask ? { ...n.mask, source: shift(n.mask.source) } : undefined,
              clip: n.clip ? { ...n.clip, source: shift(n.clip.source) } : undefined,
            };
            frame.nodes[shift(index)] = data;
            frame.changed.push(shift(index));
            if (f.order) (frame.order ??= [])[shift(index)] = f.order[index]!;
          });
        }
      },
    },
  };
}
export const components: Module = {
  name: 'components',
  after,
  entries: [],
  init(registry, shared) {
    return create(shared).init!(registry, shared);
  },
};

interface Nested extends PlayerExtension {
  players: Map<string, Player>;
}
function nest(parent: Player, data: Info, Child: typeof Player): Nested {
  const players = new Map(
    data.instances.map((i) => [
      parent.model.nodes[i.node]!.id,
      new Child(i.model, { reducedMotion: parent.reducedMotion }),
    ]),
  );
  for (const i of data.instances) {
    active?.configure?.(
      parent,
      players.get(parent.model.nodes[i.node]!.id)!,
      parent.model.nodes[i.node]!,
    );
    parent.model.bindData?.(
      parent,
      players.get(parent.model.nodes[i.node]!.id)!,
      parent.model.nodes[i.node]!,
    );
    const n = parent.model.nodes[i.node]!;
    for (const [name, value] of Object.entries(n.raw.inputs ?? {}))
      if (typeof value !== 'string') players.get(n.id)!.set(name, value as number | boolean);
  }
  const address = (name: string): [Player | undefined, string] => {
    const dot = name.indexOf('.');
    if (dot < 0) return [undefined, name];
    return [players.get(name.slice(0, dot)), name.slice(dot + 1)];
  };
  const collect = <T>(read: (p: Player) => Record<string, T>): Record<string, T> =>
    Object.fromEntries(
      [...players].flatMap(([id, p]) =>
        Object.entries(read(p)).map(([key, value]) => [id + '/' + key, value]),
      ),
    );
  return {
    players,
    input(op, name, value) {
      const [p, key] = address(name);
      if (!p || !p.model.inputs.has(key) || info.get(p.model)?.events.has(key)) return false;
      if (op === 'set') p.set(key, value!);
      else if (op === 'fire') p.fire(key);
      else if (op === 'toggle') p.toggle(key);
      else return false;
      return true;
    },
    get(name) {
      const [p, key] = address(name);
      return p?.get(key);
    },
    hits(node, x, y) {
      const n = parent.model.nodes[node]!,
        p = players.get(n.id);
      // A cleared instance has no child player and no outline.
      if (!p) return (n.type as string) === 'instance' ? false : undefined;
      if (active?.selected?.(parent, n) === false) return false;
      const inv = invert(
        mul(drawWorld(parent, node), active?.matrix?.(parent, p, n) ?? [1, 0, 0, 1, 0, 0]),
      );
      if (!inv) return false;
      const [lx, ly] = apply(inv, x, y),
        [bx, by, w, h] = p.model.viewBox;
      return lx >= bx && lx <= bx + w && ly >= by && ly <= by + h;
    },
    states: () => collect((p) => p.states()),
    values: () =>
      collect((p) => ({
        ...Object.fromEntries(
          [...p.model.inputs]
            .filter(
              ([n, i]) => i.type !== 'trigger' && (!n.includes('.') || n.startsWith('outputs.')),
            )
            .map(([n]) => {
              const v = p.get(n)!;
              return [n, Array.isArray(v) ? formatHex(v) : v];
            }),
        ),
        ...p.values(),
      })),
    inspect: () =>
      [...players].flatMap(([id, p]) =>
        p.inspect().map((l) => ({ ...l, layer: id + '/' + l.layer })),
      ),
    pointer(kind, x, y) {
      for (const i of data.instances) {
        const n = parent.model.nodes[i.node]!,
          child = players.get(n.id);
        if (!child) continue;
        const inv = invert(
          mul(drawWorld(parent, i.node), active?.matrix?.(parent, child, n) ?? [1, 0, 0, 1, 0, 0]),
        );
        const [lx, ly] = inv ? apply(inv, x, y) : [0, 0];
        players
          .get(parent.model.nodes[i.node]!.id)!
          .pointer(
            inv && parent.visible(i.node) && active?.selected?.(parent, n) !== false
              ? kind
              : 'leave',
            lx,
            ly,
          );
      }
    },
    step(dt) {
      const events: import('../../../packages/core/src/player.ts').AnimaEvent[] = [];
      let settled = true;
      const scope = new Map([...parent.model.inputs.keys()].map((n) => [n, parent.get(n)!]));
      for (const i of data.instances) {
        const n = parent.model.nodes[i.node]!,
          p = players.get(n.id)!;
        if (active?.selected?.(parent, n) === false) continue;
        for (const [name, e] of i.inputs) {
          const value = e(scope);
          const v =
            p.model.inputs.get(name)!.type === 'number' ? Number(value) : (value as boolean);
          if (p.busy || v !== p.get(name)) p.set(name, v);
        }
        for (const a of parent.addrs)
          if (a.startsWith(n.id + '.')) {
            const key = a.slice(n.id.length + 1);
            if (p.model.inputs.has(key)) {
              const v = parent.value(a) as number | boolean;
              if (p.busy || v !== p.get(key)) p.set(key, v);
            }
          }
        p.reducedMotion = parent.reducedMotion;
        if (n.raw.paused || (!parent.visible(i.node) && !p.busy)) continue;
        const result = p.step(dt * (n.raw.speed ?? 1));
        settled &&= result.settled;
        parent.drawVersions[i.node] = ++parent.drawRevision;
        for (const e of result.events) {
          const name = n.id + '.' + e.name;
          events.push({ ...e, name, layer: e.layer === null ? null : n.id + '/' + e.layer });
          if (parent.model.inputs.has(name)) parent.fire(name);
          for (const l of parent.model.listeners)
            if (l.on === name) {
              parent.act(l);
            }
        }
      }
      // Descendants run after parent bindings; shared data writes need another parent sample.
      for (const [name, value] of scope)
        if (name.startsWith('$') && JSON.stringify(value) !== JSON.stringify(parent.get(name)))
          settled = false;
      return { events, settled };
    },
  };
}
