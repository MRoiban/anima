import type { Module } from '../../../packages/core/src/modules.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { Player, PlayerExtension } from '../../../packages/core/src/player.ts';
import { drawFrame, drawTree, type DrawTree } from '../../../packages/core/src/draw.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { entries } from '../capabilities/drawing-paint-paint-artboard/registry.ts';
import { after } from '../manifest.ts';
// A source is resolved draw data, never a renderer callback or a second rendering implementation.
declare module '../../../packages/core/src/draw.ts' {
  interface DrawPaint {
    component?: DrawFrame;
  }
}
export type ComponentResource = DrawTree['resources'][number] & {
  tree: DrawTree;
  order?: number[];
};
const plans = new WeakMap<Model, Map<number, Model>>();
const children = new WeakMap<Player, Map<number, Player>>();
const stack = new Set<object>();
const name = /^component:([a-z][a-zA-Z0-9-]*)$/;
export const componentpaint: Module = {
  name: 'componentpaint',
  after,
  entries,
  init(_registry, shared) {
    return {
      ...componentpaint,
      resolve(model, d) {
        if (!model.doc.requires?.includes('componentpaint')) return;
        const sources = new Map<number, Model>();
        plans.set(model, sources);
        const paths: string[] = [],
          counts = new Map<number, number>();
        model.nodes.forEach((n, i) => {
          const j = counts.get(n.parent) ?? 0;
          counts.set(n.parent, j + 1);
          paths[i] = (n.parent < 0 ? '/nodes' : paths[n.parent] + '/children') + '/' + j;
          for (const [j, paint] of (n.raw.paints ?? []).entries())
            if (paint.fill?.paint !== undefined)
              d.err(
                'component-paint',
                paths[i] + '/paints/' + j + '/fill/paint',
                V && 'component paint uses the shape fill',
                V && 'use fill.paint instead of an ordered paint source',
              );
          if (n.raw.fill?.paint === undefined) return;
          const at = paths[i] + '/fill/paint';
          const error = (code: string, message: string | false, hint: string | false) =>
            d.err(code, at, V && message, V && hint);
          const match = name.exec(n.raw.fill?.paint);
          if (!match) {
            error(
              'component-paint',
              V && 'paint must name a component source',
              V && 'use paint="component:row"',
            );
            return;
          }
          if (!model.doc.requires.includes('components') || !model.doc.requires.includes('paint')) {
            error(
              'undeclared-feature',
              V && 'component paint needs components and paint',
              V && 'add components and paint to requires',
            );
            return;
          }
          if (n.raw.fill.color !== undefined || n.raw.fill.type !== undefined || n.raw.paints) {
            error(
              'component-paint',
              V && 'component paint cannot also supply color, type or ordered paints',
              V && 'remove color/type/paints; an ordinary stroke may remain',
            );
            return;
          }
          const definition = model.doc.components?.[match[1]!];
          if (!definition || match[1] === '$comment') {
            error(
              'unknown-component',
              V && 'unknown paint component',
              V && 'declare the named component in components',
            );
            return;
          }
          if (stack.has(definition) || stack.size >= 16) {
            error(
              'component-cycle',
              V && 'component paint source is cyclic or exceeds depth 16',
              V && 'remove recursive sources or reduce nesting',
            );
            return;
          }
          stack.add(definition);
          try {
            // Only the source's dependency closure belongs to this independent document.
            // Loading unrelated definitions would revalidate an enclosing paint as its own child.
            const definitions = model.doc.components ?? {},
              used = new Set<string>();
            const visit = (name: string) => {
              if (used.has(name) || !Object.hasOwn(definitions, name)) return;
              used.add(name);
              scan(definitions[name]);
            };
            const scan = (value: unknown): void => {
              if (!value || typeof value !== 'object') return;
              for (const [key, v] of Object.entries(value)) {
                if (key === 'component') {
                  for (const ref of typeof v === 'object' && v ? Object.values(v) : [v])
                    if (typeof ref === 'string') {
                      if (ref.startsWith('$')) Object.keys(definitions).forEach(visit);
                      else visit(ref);
                    }
                } else if (key === 'paint' && typeof v === 'string' && name.test(v))
                  visit(v.slice(10));
                scan(v);
              }
            };
            scan(definition);
            const result = shared.load({
              ...definition,
              anima: '0.1',
              name: match[1],
              requires: model.doc.requires,
              components: Object.fromEntries([...used].map((name) => [name, definitions[name]])),
              // Asset names resolve locally, then in the enclosing catalog (SPEC assets scope).
              ...(model.doc.assets && {
                assets: { ...model.doc.assets, ...(definition as { assets?: object }).assets },
              }),
            });
            for (const diag of result.diagnostics)
              if (diag.severity === 'error')
                d.err(
                  diag.code,
                  diag.pointer.startsWith('/components/')
                    ? diag.pointer
                    : ptr('/components', match[1]!) + diag.pointer,
                  diag.message,
                  diag.hint,
                );
            if (result.model) sources.set(i, result.model);
          } finally {
            stack.delete(definition);
          }
        });
      },
      load(model) {
        const sources = plans.get(model);
        if (!sources?.size) return;
        const previous = model.nesting;
        model.nesting = (p) => {
          const inputModel = p.model;
          const base = previous?.(p);
          // Resource trees are player-owned, including when the host replays a player's model.
          const tree = drawTree(p.model);
          const draw =
            p.model === inputModel
              ? { ...tree, resources: tree.resources.map((r) => ({ ...r })) }
              : tree;
          draw.resources = draw.resources.map((r) => ({ ...r }));
          const clone = { ...p.model, draw };
          const compiled = (
            _registry.get('data') as import('../../data/core/index.ts').DataModule | undefined
          )?.compiled;
          const data = compiled?.get(p.model);
          if (data) compiled!.set(clone, data);
          const assets = (
            _registry.get('assets') as
              typeof import('../../assets/core/index.ts').assets | undefined
          )?.resolvedAssets;
          const images = assets?.get(p.model) ?? assets?.get(inputModel);
          if (images) assets!.set(clone, images);
          const components = _registry.get(
            'components',
          ) as import('../../components/core/index.ts').ComponentModule;
          components.forkModel(p.model, clone);
          Object.defineProperty(p, 'model', { value: clone });
          const players = new Map(
            [...sources].map(([i, m]) => [
              i,
              new shared.Player(m, { reducedMotion: p.reducedMotion }),
            ]),
          );
          children.set(p, players);
          for (const [i, child] of players) {
            const r = draw.resources.find(
              (r) => r.node === i && r.kind === 'componentpaint',
            ) as ComponentResource;
            const frame = drawFrame(child);
            r.tree = frame.tree;
            r.order = frame.order;
          }
          const collect = <T>(method: (p: Player) => Record<string, T>) =>
            Object.fromEntries(
              [...players].flatMap(([i, child]) =>
                Object.entries(method(child)).map(([k, v]) => [
                  p.model.nodes[i]!.id + '/paint/' + k,
                  v,
                ]),
              ),
            );
          const extension: PlayerExtension = {
            ...base,
            input: (...args) => base?.input(...args) ?? false,
            get: (key) => base?.get(key),
            pointer: (...args) => base?.pointer(...args),
            hits: (...args) => base?.hits(...args),
            inspect: () => base?.inspect() ?? [],
            values: () => ({ ...base?.values(), ...collect((child) => child.values()) }),
            states: () => ({ ...base?.states(), ...collect((child) => child.states()) }),
            step(dt) {
              const result = base?.step(dt) ?? { events: [], settled: true };
              for (const [i, child] of players) {
                child.reducedMotion = p.reducedMotion;
                const revision = child.drawRevision,
                  next = child.step(dt);
                result.settled &&= next.settled;
                if (revision !== child.drawRevision) p.drawVersions[i] = ++p.drawRevision;
              }
              return result;
            },
          };
          return extension;
        };
      },
    };
  },
  draw: {
    tree(model, tree) {
      for (const [node, child] of plans.get(model) ?? [])
        tree.resources.push({
          node,
          kind: 'componentpaint',
          pointer: (tree.nodes[node]!.pointer ?? '/nodes/' + node) + '/fill/paint',
          tree: drawTree(child),
        } as ComponentResource);
    },
    end(p, f) {
      for (const [i, child] of children.get(p) ?? []) {
        const component = drawFrame(child),
          n = f.nodes[i]!;
        const paint = n.paints.find((p) => p.kind === 'fill')!;
        paint.component = component;
        paint.color = undefined;
        const index = f.tree.resources.findIndex(
          (r) => r.node === i && r.kind === 'componentpaint',
        );
        f.tree.resources[index] = {
          ...f.tree.resources[index]!,
          tree: component.tree,
          order: component.order,
        } as ComponentResource;
        f.changed.push(i);
      }
    },
  },
};
