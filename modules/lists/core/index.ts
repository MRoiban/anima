import { nodePointer as pointer } from '../../components/core/node-pointer.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { Player, PlayerExtension } from '../../../packages/core/src/player.ts';
import type { DataModule } from '../../data/core/index.ts';
import type { ComponentModule } from '../../components/core/index.ts';
import { drawFrame, drawTree, type DrawTree } from '../../../packages/core/src/draw.ts';
import { apply, invert, mul } from '../../../packages/core/src/geom.ts';
import { entries } from '../capabilities/components-list/registry.ts';
import { after } from '../manifest.ts';
import { install, bindContext, inherited, parents, error } from './context.ts';
import type { Diags } from '../../../packages/core/src/diag.ts';

interface Repeat {
  node: number;
  path: string;
  count: boolean;
  choices: Map<string, Model>;
  of?: string;
}
interface Item {
  key: object | number;
  player: Player;
  model: Model;
  index: number;
  data?: string;
}
interface Run {
  spec: Repeat;
  items: Item[];
}
export interface ListState {
  runs: Run[];
  warnings: import('../../../packages/core/src/diag.ts').Diagnostic[];
}
const states = new WeakMap<Player, ListState>();
export const listState = (p: Player) => states.get(p);
export const dynamicTrees = new WeakSet<DrawTree>();
export const lists: Module & {
  listState: typeof listState;
  // seam(P7-5): identify the owner of repeated-item data assignments.
  parents: typeof parents;
  dynamicTrees: typeof dynamicTrees;
  beforeDraw?: (player: Player) => void;
} = {
  name: 'lists',
  after,
  entries,
  listState,
  parents,
  dynamicTrees,
  init(registry, shared) {
    const data = registry.get('data') as DataModule | undefined;
    const components = registry.get('components') as ComponentModule | undefined;
    if (!data || !components) return lists;
    install(data, components);
    components.externalDrawing = (model) => !!model.doc.requires?.includes('lists');
    components.placementContext = (model, node, key) => {
      if (!model.doc.requires?.includes('lists')) return;
      const c = data.compiled.get(model);
      if ((node.type as string) === 'repeat')
        return key && key !== '*' ? key : property(data, model, node.raw.list ?? '')?.of;
      if (node.raw.data) {
        const value = readDefault(data, model, node.raw.data);
        if (value && typeof value === 'object') return c?.modelOf.get(value);
      }
    };
    return {
      ...lists,
      resolve(model, d) {
        resolve(
          model,
          d,
          data,
          components,
          shared.Player,
          registry.get('assets') as typeof import('../../assets/core/index.ts').assets | undefined,
        );
      },
      draw: {
        tree(model, tree) {
          if (!model.doc.requires?.includes('lists')) return;
          for (const [i, n] of model.nodes.entries()) {
            tree.nodes[i]!.id = n.id;
            if ((n.type as string) === 'repeat' || (n.type as string) === 'instance')
              tree.nodes[i]!.kind = 'group';
          }
        },
        end: render,
      },
    };
  },
};
function count(v: unknown): number {
  return Math.max(0, Math.min(256, Math.floor(Number(v) || 0)));
}
interface Drawing {
  mappings: Map<Player, { group: number; nodes: number[] }>;
  free: number[];
  resources: DrawTree['resources'];
  players?: Map<string, Player>;
  dependencies: Set<number>;
  initialized: boolean;
}
const drawings = new WeakMap<Player, Drawing>();
function render(p: Player, frame: import('../../../packages/core/src/draw.ts').DrawFrame) {
  const state = states.get(p),
    drawing = drawings.get(p);
  if (!state || !drawing) return;
  if (drawing.initialized && !frame.changed.some((n) => drawing.dependencies.has(n))) return;
  drawing.initialized = true;
  const tree = frame.tree;
  const entries: { player: Player; parent: number; id: string; index?: number }[] = [];
  const players = drawing.players;
  for (const [id, child] of players ?? [])
    entries.push({ player: child, parent: p.model.ids.get(id)!, id });
  for (const run of state.runs)
    for (const item of run.items)
      entries.push({
        player: item.player,
        parent: run.spec.node,
        id: p.model.nodes[run.spec.node]!.id + '/' + item.index,
        index: item.index,
      });
  const active = new Set(entries.map((e) => e.player));
  for (const [player, m] of drawing.mappings)
    if (!active.has(player)) {
      drawing.free.push(m.group, ...m.nodes);
      for (const n of [m.group, ...m.nodes]) {
        frame.nodes[n]!.visible = false;
        frame.changed.push(n);
      }
      drawing.mappings.delete(player);
    }
  for (const n of p.model.nodes)
    if ((n.type as string) === 'repeat' || (n.type as string) === 'instance')
      tree.nodes[p.model.ids.get(n.id)!]!.children = [];
  tree.resources = [...drawing.resources];
  const allocate = () => drawing.free.pop() ?? tree.nodes.length++;
  for (const entry of entries) {
    const child = drawFrame(entry.player);
    let mapping = drawing.mappings.get(entry.player);
    if (!mapping) {
      mapping = { group: allocate(), nodes: [] };
      drawing.mappings.set(entry.player, mapping);
    }
    while (mapping.nodes.length < child.tree.nodes.length) mapping.nodes.push(allocate());
    const group = mapping.group,
      shift = (n: number) => mapping!.nodes[n]!;
    const raw = p.model.nodes[entry.parent]!.raw;
    const transform: import('../../../packages/core/src/geom.ts').Mat = [
      1,
      0,
      0,
      1,
      (raw.dx ?? 0) * (entry.index ?? 0),
      (raw.dy ?? 0) * (entry.index ?? 0),
    ];
    tree.nodes[group] = {
      node: group,
      kind: 'group',
      id: entry.id,
      parent: entry.parent,
      children: child.tree.roots.map(shift),
    };
    tree.nodes[entry.parent]!.children.push(group);
    frame.nodes[group] = { transform, opacity: 1, visible: true, paints: [] };
    frame.changed.push(group);
    (frame.order ??= [])[group] = entry.index ?? group;
    const world = mul(p.world(entry.parent), transform);
    frame.nodes[group]!.world = world;
    child.tree.nodes.forEach((n, i) => {
      const source = child.nodes[i]!;
      tree.nodes[shift(i)] = {
        ...n,
        node: shift(i),
        id: entry.id + '/' + (n.id ?? entry.player.model.nodes[n.node]?.id),
        parent: n.parent < 0 ? group : shift(n.parent),
        children: n.children.map(shift),
        dependencies: undefined,
        mask: n.mask ? { ...n.mask, source: shift(n.mask.source) } : undefined,
        clip: n.clip ? { ...n.clip, source: shift(n.clip.source) } : undefined,
      };
      frame.nodes[shift(i)] = {
        ...source,
        world: source.world ? mul(world, source.world) : undefined,
        mask: source.mask ? { ...source.mask, source: shift(source.mask.source) } : undefined,
        clip: source.clip ? { ...source.clip, source: shift(source.clip.source) } : undefined,
      };
      frame.changed.push(shift(i));
      // Absent child ranks are child document indices, never recycled destination slots.
      (frame.order ??= [])[shift(i)] = child.order?.[i] ?? i;
    });
    for (const r of child.tree.resources)
      tree.resources.push({
        ...r,
        node: shift(r.node),
        source: r.source === undefined ? undefined : shift(r.source),
      });
  }
}
function resolve(
  model: Model,
  d: Diags,
  data: DataModule,
  components: ComponentModule,
  Child: typeof Player,
  assets?: typeof import('../../assets/core/index.ts').assets,
) {
  if (!model.doc.requires?.includes('lists')) return;
  if (!model.doc.requires?.includes('components') || !model.doc.requires?.includes('data')) {
    error(
      d,
      'undeclared-feature',
      '/requires',
      'lists need components and data',
      'add components and data to requires',
    );
    return;
  }
  const c = data.compiled.get(model);
  if (!c) {
    error(
      d,
      'list-source',
      '/data',
      'lists need a data model',
      'declare a model and its list or count source',
    );
    return;
  }
  const plans: Repeat[] = [];
  for (const [ni, node] of model.nodes.entries()) {
    const raw = node.raw,
      at = pointer(model, ni);
    if ((node.type as string) !== 'repeat') {
      if ((node.type as string) === 'instance' && raw.data) {
        const value = readDefault(data, model, raw.data);
        const child = components.placements.get(node)?.get('*'),
          cc = child && data.compiled.get(child);
        const expected = cc?.document.instances?.[cc.defaultName]?.model;
        const actual = value && c.modelOf.get(value);
        if (!value || typeof value !== 'object')
          error(
            d,
            'data-instance',
            at + '/data',
            'unknown component data context',
            'use a model reference or named instance',
          );
        else if (expected && actual !== expected)
          error(
            d,
            'data-type',
            at + '/data',
            'component context model does not match',
            'use the component public model',
          );
      }
      continue;
    }
    if (!!raw.list === !!raw.count)
      error(
        d,
        'list-source',
        at,
        'repeat needs exactly one list or count',
        'provide list="$items" or count="$n"',
      );
    const initial = readDefault(data, model, raw.list ?? raw.count ?? '');
    if ((Array.isArray(initial) && initial.length > 256) || (raw.count && Number(initial) > 256))
      error(
        d,
        'limit-exceeded',
        at,
        'repeat exceeds 256 instances',
        'use at most 256 instances across the component tree',
      );
    const path = raw.list ?? raw.count ?? '$invalid';
    const prop = property(data, model, path);
    if (raw.count ? model.inputs.get(path)?.type !== 'number' : prop?.type !== 'list')
      error(
        d,
        'list-source',
        at + (raw.count ? '/count' : '/list'),
        'repeat source is not a readable ' + (raw.count ? 'number' : 'list'),
        'use list="$items" or count with a numeric data path, including $items.length',
      );
    const choices = new Map<string, Model>();
    for (const [key] of typeof raw.component === 'string'
      ? [['*', raw.component]]
      : Object.entries(raw.component)) {
      const child = components.placements.get(node)?.get(key);
      if (child) choices.set(key, child);
      if (key !== '*' && !c.document.models[key])
        error(
          d,
          'list-map',
          at + '/component',
          'unknown model in component map',
          'use declared model names',
        );
    }
    if (prop?.of && !choices.has('*') && !choices.has(prop.of))
      error(
        d,
        'list-map',
        at + '/component',
        'component map has no entry for ' + prop.of,
        'add the list model to the component map',
      );
    for (const [key, child] of choices) {
      const cc = data.compiled.get(child),
        expected = cc?.document.instances?.[cc.defaultName]?.model;
      if (
        expected &&
        !inherited.has(child) &&
        (key === '*' ? prop?.of : key) &&
        expected !== (key === '*' ? prop?.of : key)
      )
        error(
          d,
          'data-type',
          at + '/component',
          'repeat item and component model differ',
          'use a component for the item model',
        );
    }
    for (const child of new Set(choices.values()))
      for (const [name, input] of child.inputs)
        if (!name.startsWith('$') && !name.includes('.'))
          for (let i = 0; i < 256; i++) {
            const address = node.id + '.' + i + '.' + name;
            const old = model.inputs.get(address);
            if (old && old.type !== input.type)
              error(
                d,
                'data-type',
                at + '/component',
                'mapped component input types differ',
                'use consistent input types across mapped components',
              );
            model.inputs.set(address, { ...input, name: address });
          }
    plans.push({ node: ni, path, count: !!raw.count, choices, of: prop?.of });
  }
  const oldBind = model.bindData;
  model.bindData = (p, child, node) => {
    oldBind?.(p, child, node);
    const value = node.raw.data
      ? read(data, p, node.raw.data)
      : inherited.has(child.model)
        ? data.dataState(p)?.instances[c.defaultName]
        : undefined;
    bindContext(data, p, child, value as object | undefined);
  };
  const previous = model.nesting;
  if (!plans.length && !model.nodes.some((n) => (n.type as string) === 'instance')) {
    model.nesting = (p) => budgeted(p, previous?.(p));
    return;
  }
  model.nesting = (p) => {
    const base = previous?.(p);
    const state: ListState = { runs: plans.map((spec) => ({ spec, items: [] })), warnings: [] };
    const tree = drawTree(model);
    const draw = {
      ...tree,
      nodes: tree.nodes.map((n) => ({ ...n, children: [...n.children] })),
      roots: [...tree.roots],
      resources: [...tree.resources],
    };
    const clone = { ...model, draw };
    if (inherited.has(model)) inherited.add(clone);
    const previousStep = model.afterStep;
    clone.afterStep = (p) => {
      previousStep?.(p);
      drawFrame(p);
      lists.beforeDraw?.(p);
    };
    Object.defineProperty(p, 'model', { value: clone });
    components.forkModel(model, clone);
    const resources = assets?.resolvedAssets.get(model);
    if (resources) assets!.resolvedAssets.set(clone, resources);
    data.compiled.set(clone, c);
    dynamicTrees.add(draw);
    drawings.set(p, {
      mappings: new Map(),
      free: [],
      resources: [...draw.resources],
      players: (base as { players?: Map<string, Player> } | undefined)?.players,
      dependencies: new Set(
        model.nodes.flatMap((node, i) => {
          if (!['repeat', 'instance'].includes(node.type as string)) return [];
          const out: number[] = [];
          for (let at = i; at >= 0; at = model.nodes[at]!.parent) out.push(at);
          return out;
        }),
      ),
      initialized: false,
    });
    states.set(p, state);
    return extend(p, base, state, data, Child);
  };
}
function readDefault(data: DataModule, model: Model, path: string): unknown {
  const c = data.compiled.get(model);
  if (!c) return;
  const m = /^\$(?:([\w-]+):)?(.+)$/.exec(path);
  if (!m) return c.defaults[path];
  let v: unknown = c.defaults[m[1] ?? c.defaultName];
  for (const k of m[2]!.split('.')) v = v && (v as Record<string, unknown>)[k];
  return v;
}
function read(data: DataModule, p: Player, path: string): unknown {
  const s = data.dataState(p)!;
  return path.startsWith('$') ? s.read(path) : s.instances[path];
}
function property(data: DataModule, model: Model, path: string) {
  const c = data.compiled.get(model);
  if (!c) return;
  const m = /^\$(?:([\w-]+):)?(.+)$/.exec(path);
  if (!m) return;
  let name = c.document.instances?.[m[1] ?? c.defaultName]?.model;
  let prop;
  for (const key of m[2]!.split('.')) {
    prop = c.document.models[name ?? '']?.properties[key];
    name = prop?.model ?? prop?.of;
  }
  return prop;
}

let depth = 0,
  expanded = 0;
function budgeted(p: Player, base?: PlayerExtension): PlayerExtension {
  return {
    ...base,
    input: (op, name, value) => base?.input(op, name, value) ?? false,
    get: (name) => base?.get(name),
    states: () => base?.states() ?? {},
    values: () => base?.values() ?? {},
    inspect: () => base?.inspect() ?? [],
    hits: (node, x, y) => base?.hits(node, x, y),
    pointer(kind, x, y) {
      base?.pointer(kind, x, y);
    },
    step(dt) {
      if (!depth) expanded = 0;
      else if (++expanded > 256) throw limit(p);
      depth++;
      try {
        return base?.step(dt) ?? { events: [], settled: true };
      } finally {
        depth--;
      }
    },
  };
}
function extend(
  p: Player,
  base: PlayerExtension | undefined,
  state: ListState,
  data: DataModule,
  Child: typeof Player,
): PlayerExtension {
  const each = () =>
    state.runs.flatMap((r) =>
      r.items.map((item) => ({
        ...item,
        run: r,
        id: p.model.nodes[r.spec.node]!.id + '.' + item.index,
      })),
    );
  const target = (name: string) => {
    const e = each().find((i) => name.startsWith(i.id + '.'));
    return e && { ...e, key: name.slice(e.id.length + 1) };
  };
  const collect = <T>(fn: (p: Player) => Record<string, T>) =>
    Object.fromEntries(
      each().flatMap((i) =>
        Object.entries(fn(i.player)).map(([k, v]) => [i.id.replaceAll('.', '/') + '/' + k, v]),
      ),
    );
  const observed = [...p.model.inputs.keys()].filter((n) => n[0] === '$');
  const sample = () => {
    const own = data.dataState(p)!;
    return observed.map((n) => JSON.stringify(own.get(n)));
  };
  let observedValues: (string | undefined)[] = [];
  let initializing = true;
  const extension: PlayerExtension = {
    ...base,
    input(op, name, value) {
      if (name[0] === '$') return base?.input(op, name, value) ?? false;
      const t = target(name);
      if (!t) return base?.input(op, name, value) ?? false;
      if (op === 'set') t.player.set(t.key, value!);
      else if (op === 'fire') t.player.fire(t.key);
      else t.player.toggle(t.key);
      return true;
    },
    get(name) {
      if (name[0] === '$') return base?.get(name);
      const t = target(name);
      return t ? t.player.get(t.key) : base?.get(name);
    },
    states: () => ({ ...base?.states(), ...collect((p) => p.states()) }),
    values: () => ({
      ...base?.values(),
      ...collect((p) => ({
        ...Object.fromEntries(
          [...p.model.inputs]
            .filter(([n, i]) => !n.startsWith('$') && !n.includes('.') && i.type !== 'trigger')
            .map(([n]) => [n, p.get(n) as number | string | boolean]),
        ),
        ...p.values(),
      })),
    }),
    inspect: () => [
      ...(base?.inspect() ?? []),
      ...each().flatMap((i) =>
        i.player.inspect().map((l) => ({ ...l, layer: i.id.replaceAll('.', '/') + '/' + l.layer })),
      ),
    ],
    hits: (node, x, y) => base?.hits(node, x, y),
    pointer(kind, x, y) {
      base?.pointer(kind, x, y);
      for (const i of each()) {
        const raw = p.model.nodes[i.run.spec.node]!.raw,
          inv = invert(p.world(i.run.spec.node));
        const [lx, ly] = inv ? apply(inv, x, y) : [0, 0];
        i.player.pointer(
          inv && p.visible(i.run.spec.node) ? kind : 'leave',
          lx - (raw.dx ?? 0) * i.index,
          ly - (raw.dy ?? 0) * i.index,
        );
      }
    },
    step(dt) {
      if (!initializing) {
        if (!depth) expanded = 0;
        else if (++expanded > 256) throw limit(p, state.runs[0]?.spec.node);
        depth++;
      }
      try {
        // Descendant writes to shared data need another parent binding sample (SPEC inherited data context).
        const before = initializing ? [] : sample();
        const result = (initializing ? undefined : base?.step(dt)) ?? { events: [], settled: true };
        const current = !initializing && base ? sample() : before;
        const dataChanged =
          !initializing && current.some((value, i) => value !== observedValues[i]);
        let total = 0;
        let childStepped = false;
        for (const run of state.runs) {
          const raw = p.model.nodes[run.spec.node]!.raw;
          const source = read(data, p, run.spec.path);
          const items = run.spec.count
            ? Array.from({ length: count(source) }, (_, i) => i)
            : Array.isArray(source)
              ? source
              : [];
          if (total + items.length > 256 || (run.spec.count && Number(source) > 256))
            throw limit(p, run.spec.node);
          total += items.length;
          const sameItems =
            items.length === run.items.length && items.every((key, i) => run.items[i]!.key === key);
          let dirty = !sameItems;
          if (sameItems && !dataChanged) {
            for (const item of run.items) {
              const itemData = typeof item.key === 'object' ? JSON.stringify(item.key) : undefined;
              const itemChanged = itemData !== item.data;
              item.player.reducedMotion = p.reducedMotion;
              if (!itemChanged && !item.player.busy) continue;
              if (itemChanged) {
                bindContext(data, p, item.player, item.key as object, item.index);
                item.data = itemData;
              }
              const r = item.player.step(dt);
              childStepped = dirty = true;
              result.settled &&= r.settled;
              for (const e of r.events)
                result.events.push({
                  ...e,
                  name: raw.id + '.' + item.index + '.' + e.name,
                  layer: e.layer === null ? null : raw.id + '/' + item.index + '/' + e.layer,
                });
            }
            if (dirty) p.drawVersions[run.spec.node] = ++p.drawRevision;
            continue;
          }
          const available = new Map<object | number, Item[]>();
          for (const i of run.items) available.set(i.key, [...(available.get(i.key) ?? []), i]);
          run.items = items.flatMap((key, index) => {
            const type =
              typeof key === 'object' && key ? (itemType(data, p, key) ?? run.spec.of) : undefined;
            // Initial scopes clone the compiled graph; fixed lists retain their declared model.
            const model = run.spec.choices.get(type ?? '') ?? run.spec.choices.get('*');
            if (!model) {
              if (!state.warnings.some((w) => w.code === 'list-map'))
                state.warnings.push({
                  code: 'list-map',
                  severity: 'warning',
                  pointer: pointer(p.model, run.spec.node) + '/component',
                  message: 'item model has no component mapping',
                  hint: 'add a mapping for ' + type,
                });
              return [];
            }
            let item = available.get(key)?.shift();
            const created = !item || item.model !== model;
            if (created)
              item = {
                key,
                model,
                index,
                player: new Child(model, { reducedMotion: p.reducedMotion }),
              };
            if (!item) throw Error('anima: list instance');
            if (created && raw.size && !item!.player.model.doc.hit) {
              const hits = item.player.hits.bind(item.player),
                size = raw.size;
              item.player.hits = (l, x, y) =>
                l.target < 0
                  ? x >= -l.pad && y >= -l.pad && x <= size[0] + l.pad && y <= size[1] + l.pad
                  : hits(l, x, y);
            }
            item.index = index;
            const scope = data.dataState(p)!;
            const value =
              typeof key === 'object'
                ? key
                : inherited.has(item.player.model)
                  ? scope.instances[scope.compiled.defaultName]
                  : undefined;
            bindContext(data, p, item.player, value, index);
            item.data = typeof key === 'object' ? JSON.stringify(key) : undefined;
            item.player.reducedMotion = p.reducedMotion;
            const r = initializing ? { events: [], settled: true } : item.player.step(dt);
            if (!initializing) childStepped = dirty = true;
            result.settled &&= r.settled;
            for (const e of r.events)
              result.events.push({
                ...e,
                name: raw.id + '.' + index + '.' + e.name,
                layer: e.layer === null ? null : raw.id + '/' + index + '/' + e.layer,
              });
            return [item];
          });
          if (dirty || initializing) p.drawVersions[run.spec.node] = ++p.drawRevision;
        }
        const after = !initializing && childStepped ? sample() : current;
        if (!initializing && before.some((value, i) => value !== after[i])) result.settled = false;
        observedValues = initializing ? sample() : after;
        return result;
      } finally {
        if (!initializing) depth--;
      }
    },
  };
  extension.step(0);
  drawFrame(p);
  initializing = false;
  return extension;
}
function limit(p: Player, node?: number) {
  return Object.assign(new Error('anima: limit-exceeded repeat instances'), {
    code: 'limit-exceeded',
    pointer: node === undefined ? '/nodes' : pointer(p.model, node),
    hint: 'use at most 256 instances across the component tree',
  });
}

function itemType(data: DataModule, player: Player, value: object): string | undefined {
  let scope: Player | undefined = player;
  while (scope) {
    const name = data.dataState(scope)?.modelTypes?.get(value);
    if (name) return name;
    scope = parents.get(scope);
  }
}
