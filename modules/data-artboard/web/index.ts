import './values.ts';
import type { dataArtboard } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { Model } from '../../../packages/core/src/load.ts';
import type { ComponentModule } from '../../components/core/index.ts';
import type { DataModule } from '../../data/core/index.ts';
import type { assets } from '../../assets/core/index.ts';
import type { FontModule } from '../../fonts/core/index.ts';
import type { FontController } from '../../fonts/web/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
const live = Icon.modules.get('dataartboard') as typeof dataArtboard;
// A separately bundled second import keeps the first bridge's maps and hooks.
const installed = !!live.resources.adopt;
type Resource = { records?: Model['doc']['assets']; fonts?: (target: FontController) => void };
type Scope = Map<object, Resource>;
const initialized = new WeakSet<Player>();
const hosts = new Set<WeakRef<AnimaIcon>>();
const known = new WeakSet<AnimaIcon>();
const sources = new WeakMap<Model, Scope>();
const contexts = new WeakMap<Player | object, Scope>();
const owners = new WeakMap<Player, AnimaIcon>();
const controllers = new WeakMap<Player, FontController>();
const retained = new WeakMap<AnimaIcon, Map<Player, FontController>>();
const module = <T>(name: string) => Icon.modules.get(name) as T | undefined;
const children = (p: Player): Player[] => [
  ...[...((p.nested as { players?: Map<string, Player> })?.players ?? [])]
    .filter(([id]) => {
      const node = p.model.nodes[p.model.ids.get(id)!];
      return !node || module<ComponentModule>('components')?.selected?.(p, node) !== false;
    })
    .map(([, child]) => child),
  ...(module<typeof import('../../lists/core/index.ts').lists>('lists')
    ?.listState(p)
    ?.runs.flatMap((r) => r.items.map((i) => i.player)) ?? []),
];
const each = (p: Player, visit: (p: Player) => void) => {
  visit(p);
  for (const child of children(p)) each(child, visit);
};
function owner(player: Player): AnimaIcon | undefined {
  if (!owners.has(player))
    for (const ref of hosts) {
      const host = ref.deref();
      if (!host) hosts.delete(ref);
      else if (host.player) each(host.player, (p) => owners.set(p, host));
    }
  return owners.get(player);
}
// Values use a cloned document identity; source hosts may share the same compiled catalog.
const component = Icon.prototype.component;
const values = new WeakMap<Model, Map<string, ReturnType<typeof component>>>();
if (!installed)
  Icon.prototype.component = (document, name) => {
    const scope = sources.get(document),
      components = module<ComponentModule>('components');
    const source = components?.catalog.get(document)?.get(name);
    if (!scope || !source) return component(document, name);
    let choices = values.get(document);
    if (!choices) values.set(document, (choices = new Map()));
    let value = choices.get(name);
    if (!value) {
      const child = { ...source, doc: { ...source.doc } },
        wrapper = { ...document };
      components!.forkModel(source, child);
      const data = module<DataModule>('data'),
        compiled = data?.compiled.get(source);
      if (compiled) data!.compiled.set(child, compiled);
      components!.catalog.set(wrapper, new Map([[name, child]]));
      contexts.set(child.doc, new Map([...scope, [child.doc, scope.get(source.doc)!]]));
      choices.set(name, (value = component(wrapper, name)));
    }
    return value;
  };
const previousLoader = Icon.loadAssets;
if (!installed)
  Icon.loadAssets = async (icon, model) => initialize(model, await previousLoader?.(icon, model));
// Cached initializers retain models/catalogs, never the first host that decoded them.
function initialize(root: Model, prior?: (player: Player) => boolean): (player: Player) => boolean {
  const scopes = new WeakMap<Player, Scope>();
  const resources = module<typeof assets>('assets');
  const collect = (
    model: Model,
    scope: Scope,
    icon: AnimaIcon,
    catalogs: Map<object, NonNullable<Model['doc']['assets']>> | undefined,
  ) => {
    if (scope.has(model.doc)) return;
    scope.set(model.doc, {
      records: catalogs?.get(model.doc) ?? resources?.resolvedAssets.get(model),
      fonts: icon.fonts && (model === root ? icon.fonts : icon.fonts.forModel(model)).capture(),
    });
    const components = module<ComponentModule>('components');
    for (const child of [
      ...(components?.catalog.get(model)?.values() ?? []),
      ...model.nodes.flatMap((n) => [...(components?.placements.get(n)?.values() ?? [])]),
    ])
      collect(child, scope, icon, catalogs);
  };
  return (player) => {
    const changed = prior?.(player) ?? false,
      icon = owner(player);
    if (!icon?.player) return changed;
    let scope = scopes.get(icon.player);
    if (!scope) scopes.set(icon.player, (scope = new Map()));
    collect(root, scope, icon, resources?.catalogs.get(player));
    if (player === icon.player && !initialized.has(player)) {
      initialized.add(player);
      const source = player.model,
        clone = { ...source };
      module<ComponentModule>('components')?.forkModel(source, clone);
      const data = module<DataModule>('data'),
        compiled = data?.compiled.get(source);
      if (compiled) data!.compiled.set(clone, compiled);
      Object.defineProperty(player, 'model', { value: clone });
    }
    sources.set(player.model, contexts.get(player) ?? scope);
    return changed;
  };
}
// The composed module survives separately bundled imports; no second core registry is used.
if (!installed)
  live.resources.adopt = (parent, child) => {
    const icon = owner(parent);
    if (!icon) return;
    const scope = contexts.get(child.model.doc) ?? contexts.get(parent);
    each(child, (p) => {
      owners.set(p, icon);
      if (!scope) return;
      contexts.set(p, scope);
      const resource = scope.get(p.model.doc);
      if (resource?.records)
        module<typeof assets>('assets')?.resolvedAssets.set(p, resource.records);
      if (resource?.fonts && icon.fonts && !controllers.has(p)) {
        const controller = new (icon.fonts.constructor as typeof FontController)(icon);
        resource.fonts(controller);
        controllers.set(p, controller);
        let owned = retained.get(icon);
        if (!owned) retained.set(icon, (owned = new Map()));
        owned.set(p, controller);
      }
    });
    const fonts = module<FontModule>('fonts');
    if (fonts) fonts.controller = (p) => controllers.get(p);
  };
const previousHook = Icon.eventHook;
if (!installed)
  Icon.eventHook = (icon, kind, detail) => {
    if (!known.has(icon)) {
      known.add(icon);
      hosts.add(new WeakRef(icon));
    }
    const owned = retained.get(icon);
    if (owned && (kind === 'cleanup' || kind === 'draw')) {
      const live = new Set<Player>();
      if (kind !== 'cleanup' && icon.player) each(icon.player, (p) => live.add(p));
      for (const [p, controller] of owned)
        if (!live.has(p)) {
          controller.clear();
          controllers.delete(p);
          owned.delete(p);
        }
      if (!owned.size) retained.delete(icon);
    }
    previousHook?.(icon, kind, detail);
  };
