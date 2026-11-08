import type { Module } from '../../../packages/core/src/modules.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { ObjShape, Shape } from '../../../packages/core/src/registry.ts';
import type { DataModule } from '../../data/core/index.ts';
import type { ComponentModule } from '../../components/core/index.ts';
import { after } from '../manifest.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { compatible } from './schema.ts';
import { entries } from '../capabilities/data-host-artboard/registry.ts';

export interface ComponentValue {
  readonly document: Model;
  readonly name: string;
}
export function component(document: Model, name: string): ComponentValue {
  return { document, name };
}
function failure(code: string, path: string): never {
  throw Object.assign(
    new Error(
      V
        ? code === 'artboard-model'
          ? 'assigned artboard data model is incompatible with the placement model'
          : 'invalid artboard value (' + code + ')'
        : code,
    ),
    {
      code,
      pointer: '/data/' + path.replace(/~/g, '~0').replace(/\//g, '~1'),
      hint:
        V &&
        (code === 'artboard-model'
          ? 'use matching data property types, enum members and referenced models in the placement context'
          : 'use a declared component and its loaded document'),
    },
  );
}
export const assignments = new WeakMap<Player, Map<string, Model> & { next?: number }>();
const queued = new WeakMap<Player, string[]>();
const parents = new WeakMap<Player, Player>();
export const dataArtboard: Module & {
  resources: { adopt?: (parent: Player, child: Player) => void };
} = {
  resources: {},
  name: 'dataartboard',
  after,
  entries,
  init(registry, shared) {
    const data = registry.get('data') as DataModule | undefined;
    const components = registry.get('components') as ComponentModule | undefined;
    const lists = registry.get('lists') as
      (Module & { parents: WeakMap<Player, Player> }) | undefined;
    const host = registry.get('host') as typeof import('../../host/core/index.ts').host | undefined;
    if (!data || !components || !host) return dataArtboard;
    const property = (
      (
        (((shared.DOC as ObjShape).p.data as ObjShape).p.models as Extract<Shape, { k: 'map' }>)
          .of as ObjShape
      ).p.properties as Extract<Shape, { k: 'map' }>
    ).of as ObjShape;
    const type = property.p.type as Extract<Shape, { k: 'str' }>;
    if (!type.of!.includes('artboard')) type.of = [...type.of!, 'artboard'];
    const ownerOf = (p: Player): Player => {
      const parent = parents.get(p) ?? lists?.parents.get(p);
      return parent ? ownerOf(parent) : p;
    };
    const prune = (p: Player) => {
      const choices = assignments.get(p);
      if (!choices) return;
      const live = new Set<unknown>(queued.get(p)),
        seen = new Set<unknown>();
      const scan = (value: unknown) => {
        if (!value || typeof value !== 'object') live.add(value);
        else if (!seen.has(value)) {
          seen.add(value);
          Object.values(value).forEach(scan);
        }
      };
      const visit = (player: Player) => {
        scan(data.dataState(player)?.instances);
        for (const child of host.children!(player)) visit(child);
      };
      visit(p);
      for (const [name] of choices) if (!live.has(name)) choices.delete(name);
    };
    const configure = components.configure;
    let depth = 0;
    components.configure = (parent, child, node) => {
      parents.set(child, parent);
      const scope = data.dataState(child);
      if (scope) scope.componentValues = assignments.get(ownerOf(parent));
      configure?.(parent, child, node);
      const target = data.compiled.get(parent.model),
        source = data.compiled.get(child.model);
      if (
        target &&
        String(data.dataState(parent)?.read(node.raw.component)).startsWith('$external:') &&
        ((source && child.model.inheritedData) ||
          node.raw.data ||
          target.refs.get(node.raw.component)?.property.model) &&
        !compatible(target, source, node.raw.data, node.raw.component)
      )
        failure('artboard-model', node.raw.component);
      dataArtboard.resources.adopt?.(parent, child);
      if (!parent.model.doc.requires?.includes('dataartboard') && !depth) return;
      const step = child.step;
      child.step = function (dt) {
        if (depth >= 8) failure('limit-exceeded', node.raw.component);
        depth++;
        try {
          return step.call(this, dt);
        } finally {
          depth--;
        }
      };
    };
    const prepare = data.prepare!;
    data.prepare = function (model, diag) {
      const original = model.doc;
      if (
        original.requires?.includes('dataartboard') &&
        original.data &&
        typeof original.data !== 'string'
      ) {
        const document = { ...original.data, models: { ...original.data.models } };
        for (const [name, def] of Object.entries(document.models) as [
          string,
          { properties?: Record<string, { type: string }> },
        ][]) {
          if (!def.properties) continue;
          const properties = { ...def.properties };
          document.models[name] = { ...def, properties };
          for (const [key, p] of Object.entries(properties))
            if (p.type === 'artboard') properties[key] = { ...p, type: 'component' };
        }
        model.doc = { ...original, data: document };
      }
      try {
        prepare.call(this, model, diag);
      } finally {
        model.doc = original;
      }
    };
    host.Data.prototype.artboard = function (path) {
      const handle = this.component(path);
      return {
        ...handle,
        get value() {
          return handle.value;
        },
        set: (value) => {
          let name: string | undefined;
          if (typeof value === 'string') name = value;
          else {
            if (!value || typeof value !== 'object') failure('data-type', path);
            const child =
              value?.document && components.catalog.get(value.document)?.get(value.name);
            if (!child) failure(value?.document ? 'unknown-component' : 'artboard-document', path);
            const owner = ownerOf(this.player);
            let choices = assignments.get(owner);
            if (!choices) assignments.set(owner, (choices = new Map()));
            name = [...choices].find(([, model]) => model === child)?.[0];
            if (!name) name = '$external:' + (choices.next = (choices.next ?? -1) + 1);
            choices.set(name, child);
            const scope = data.dataState(this.player);
            if (scope) scope.componentValues = choices;
          }
          try {
            handle.set(name);
            const owner = ownerOf(this.player);
            let pending = queued.get(owner);
            if (!pending) queued.set(owner, (pending = []));
            pending.push(name);
            this.enqueue(() => pending!.splice(pending!.indexOf(name), 1));
          } catch (error) {
            if (name && (error as { code?: string }).code === 'data-type')
              failure('unknown-component', path);
            throw error;
          }
        },
      };
    };
    return {
      ...dataArtboard,
      prepare(model) {
        if (
          model.doc.requires?.includes('dataartboard') &&
          model.nodes.some(
            (n) => (n.type as string) === 'instance' && n.raw.component.startsWith('$'),
          ) &&
          !Object.keys(model.doc.components ?? {}).some((k) => k !== '$comment')
        )
          model.doc = {
            ...model.doc,
            components: {
              empty: { grid: 20, nodes: [{ id: 'empty', type: 'group', children: [] }] },
            },
          };
      },
      load(model) {
        if (!model.doc.requires?.includes('dataartboard')) return;
        const after = model.afterStep;
        model.afterStep = (p) => {
          after?.(p);
          prune(p);
        };
        const factory = model.nesting;
        if (!factory) return;
        model.nesting = (p) => {
          const base = factory(p);
          // seam(P7-2): the nesting factory may decline (no nested scene for this player).
          if (!base) return base;
          const step = base.step.bind(base);
          base.step = (dt) => {
            const values = assignments.get(p);
            if (!values?.size) return step(dt);
            const restore: (() => void)[] = [],
              seen = new Set<Model>();
            const patch = (m: Model) => {
              if (seen.has(m)) return;
              seen.add(m);
              for (const node of m.nodes) {
                const choices = components.placements.get(node);
                if (
                  (node.type as string) !== 'instance' ||
                  !node.raw.component.startsWith('$') ||
                  !choices
                )
                  continue;
                for (const [key, child] of values) {
                  const before = choices.get(key);
                  choices.set(key, child);
                  restore.push(() => {
                    if (before) choices.set(key, before);
                    else choices.delete(key);
                  });
                }
              }
              for (const child of components.catalog.get(m)?.values() ?? []) patch(child);
            };
            patch(p.model);
            for (const source of values.values()) patch(source);
            try {
              return step(dt);
            } finally {
              for (const run of restore.reverse()) run();
            }
          };
          return base;
        };
      },
    } satisfies Module;
  },
};
declare module '../../host/core/api.ts' {
  interface HostData {
    artboard(path: string): DataHandle<string | ComponentValue>;
  }
}
