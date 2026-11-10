import type { Model } from '../../../packages/core/src/load.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { Diags } from '../../../packages/core/src/diag.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import type { DataModule } from '../../data/core/index.ts';
import type { ComponentModule } from '../../components/core/index.ts';
import type { Ref } from '../../data/core/types.ts';
import { inputFor } from '../../data/core/storage.ts';

const pending = new WeakMap<object, { parent: Model; inherit: boolean }>();
export const parents = new WeakMap<Player, Player>();
export const inherited = new WeakSet<Model>();
export function install(data: DataModule, components: ComponentModule): void {
  const previousKey = components.componentKey;
  const previousLoad = components.loadComponent;
  components.componentKey = (model, name) => {
    const c = data.compiled.get(model);
    return (
      (previousKey?.(model, name) ?? name) +
      ':' +
      c?.document.instances?.[c.defaultName]?.model +
      ':' +
      [...(c?.refs.keys() ?? [])]
        .filter((p) => p.startsWith('$parent'))
        .map((p) => p + ':' + c!.refs.get(p)!.input.type)
        .join(',')
    );
  };
  components.loadComponent = (p, _name, doc, shares, run, itemModel) => {
    // A context-less component inherits its actual enclosing model, rather than the root model.
    if (shares && doc.data && typeof doc.data !== 'string') {
      const c = data.compiled.get(p);
      if (c)
        doc = {
          ...doc,
          data: { ...doc.data, model: itemModel ?? c.document.instances![c.defaultName]!.model },
        };
    }
    const load = (document: typeof doc) => {
      pending.set(document, { parent: p, inherit: shares });
      return run(document);
    };
    return previousLoad ? previousLoad(p, _name, doc, shares, load, itemModel) : load(doc);
  };
  data.prepareContext = (model, d) => {
    if (!model.doc.requires?.includes('lists')) return;
    const c = data.compiled.get(model);
    if (!c) return;
    const { parent, inherit } = pending.get(model.doc) ?? {};
    for (const [name, def] of Object.entries(c.document.models))
      for (const key of ['index', 'parent'])
        if (Object.hasOwn(def.properties, key))
          error(
            d,
            'reserved-name',
            ptr('/data/models', name) + '/properties/' + key,
            key + ' is a reserved context name',
            'rename the property',
          );
    const add = (path: string, ref: Ref) => {
      c.refs.set(path, ref);
      model.inputs.set(path, ref.input);
    };
    if (parent) {
      if (inherit) inherited.add(model);
      const outer = data.compiled.get(parent);
      for (const [path, ref] of outer?.refs ?? [])
        if (path.startsWith('$') && !path.includes(':')) {
          const name = '$parent.' + path.slice(1);
          add(name, {
            ...ref,
            readonly: true,
            instance: '@' + ref.instance,
            input: { ...ref.input, name, readonly: true },
          });
        }
    }
    const property = { type: 'number' as const };
    add('$index', {
      instance: '@index',
      keys: ['value'],
      property,
      readonly: true,
      input: inputFor(property, 0, '$index', true),
    });
  };
}
export function bindContext(
  data: DataModule,
  parent: Player,
  child: Player,
  value?: object,
  index?: number,
): void {
  const a = data.dataState(parent),
    b = data.dataState(child);
  if (!a || !b) return;
  parents.set(child, parent);
  // A child without `data` inherits its actual parent's context (review R2-1), and one naming a
  // model shares the document's declarations: their named instances are the parent's live objects
  // (#49). A component with its own `data` object keeps its instances local (review R1-1).
  type Doc = { data?: { instances?: object } };
  const shared =
    inherited.has(child.model) ||
    (child.model.doc as Doc).data?.instances === (parent.model.doc as Doc).data?.instances;
  for (const [key, object] of Object.entries(a.instances)) {
    b.instances['@' + key] = object;
    if (shared && key[0] !== '@' && key !== b.compiled.defaultName && key in b.instances)
      b.instances[key] = object;
  }
  b.instances['@index'] = { value: index ?? Number(a.get('$index') ?? 0) };
  if (value) b.instances[b.compiled.defaultName] = value as Record<string, unknown>;
  const nested = child.nested as { players?: Map<string, Player> } | undefined;
  for (const [id, grandchild] of nested?.players ?? []) {
    const node = child.model.nodes.find((n) => n.id === id);
    if (node) child.model.bindData?.(child, grandchild, node);
  }
}
export function error(d: Diags, code: string, at: string, message: string, hint: string): void {
  d.err(code, at, V && message, V && hint);
}
