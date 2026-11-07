import type { Player } from '../../../packages/core/src/player.ts';
import type { AnimaIcon as IconType } from '../../../packages/web/src/index.ts';
import { hostEdit, queueEdit } from '../core/index.ts';
import { fail } from '../../host/core/errors.ts';
import '../../../packages/web/src/index.ts';
import type { assets, Asset } from '../../assets/core/index.ts';
const Icon = customElements.get('anima-icon') as typeof IconType;
Icon.registerModule(hostEdit);
const owners = new WeakMap<Player, IconType>();
const children = new WeakSet<Player>();
const priorHook = Icon.eventHook;
Icon.eventHook = (icon, kind, detail) => {
  if (icon.player) owners.set(icon.player, icon);
  priorHook?.(icon, kind, detail);
};
const versions = new WeakMap<Player, Map<string, number>>();
const replacementIds = new WeakMap<Player, Map<string, { id: string; source: string }>>();
hostEdit.resourceType = (player, name) =>
  (Icon.modules.get('assets') as typeof assets | undefined)?.resolvedAssets.get(player)?.[name]
    ?.type;
hostEdit.replaceImage = async (api, path, value) => {
  const icon = owners.get(api.player);
  const root = icon?.player;
  const target = api.canonical(path);
  const id = api.image(path).value;
  const assetsModule = Icon.modules.get('assets') as typeof assets | undefined;
  const records =
    assetsModule?.resolvedAssets.get(api.player) ??
    assetsModule?.resolvedAssets.get(api.player.model);
  const record = records?.[id];
  if (!icon || !root || !record || record.type !== 'image')
    fail('asset', path, 'image property must point at a loaded image asset');
  if (!(value instanceof Blob) && typeof value !== 'string')
    fail('type', path, 'image replacement must be an asset name, URL or Blob');
  let pending = versions.get(api.player);
  if (!pending) versions.set(api.player, (pending = new Map()));
  const revision = (pending.get(target) ?? 0) + 1;
  pending.set(target, revision);
  try {
    const source =
      value instanceof Blob
        ? await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(Error('image blob read failed'));
            reader.readAsDataURL(value);
          })
        : new URL(value as string, new URL(icon.getAttribute('src') ?? '', document.baseURI)).href;
    const url = new URL(source);
    const policy = (icon as IconType & { assetPolicy?: string }).assetPolicy;
    if (url.protocol !== 'data:' && url.origin !== location.origin && policy !== 'any')
      fail('asset', path, 'external image URL requires assetPolicy any');
    if (!['data:', 'http:', 'https:', 'blob:'].includes(url.protocol))
      fail('asset', path, 'unsupported image URL protocol');
    const image = new Image();
    image.src = source;
    await image.decode();
    queueEdit(api, () => {
      if (pending!.get(target) !== revision || icon.player !== root) return;
      const local = { ...(assetsModule!.resolvedAssets.get(api.player) ?? records) };
      assetsModule!.resolvedAssets.set(api.player, local);
      let ids = replacementIds.get(api.player);
      if (!ids) replacementIds.set(api.player, (ids = new Map()));
      const replacement = {
        id: '@' + target + ':' + revision,
        source: ids.get(target)?.source ?? id,
      };
      ids.set(target, replacement);
      local[replacement.id] = {
        ...record,
        source,
        width: image.naturalWidth,
        height: image.naturalHeight,
      } as Asset;
      const match = /^\$([^:]+):(.+)$/.exec(target)!;
      const keys = match[2]!.split('.');
      let values = api.record(match[1]!)!.values;
      for (const key of keys.slice(0, -1)) values = values[key] as Record<string, unknown>;
      values[keys.at(-1)!] = replacement.id;
      // Legacy static consumers have no binding to follow the addressed data property.
      if (!api.player.addrs.some((address) => address.endsWith('.asset')))
        local[replacement.source] = local[replacement.id]!;
      for (let i = 0; i < api.player.model.nodes.length; i++)
        api.player.drawVersions[i] = ++api.player.drawRevision;
    });
  } catch {
    fail('asset', path, 'cannot decode replacement image');
  }
};

// Registration is synchronous. The microtask lets all entries in the current import group settle.
Object.defineProperty(Icon, 'ready', {
  configurable: true,
  get: () => Promise.resolve().then(() => {}),
});
Icon.prototype.instance = function (id: string): Player {
  if (typeof id !== 'string') fail('type', String(id), 'component instance id must be a string');
  let player = this.player;
  for (const key of id.split('.')) {
    player = (player?.nested as { players?: Map<string, Player> } | undefined)?.players?.get(key);
    if (!player) fail('instance', id, 'unknown component instance');
  }
  owners.set(player!, this);
  if (!children.has(player!)) {
    children.add(player!);
    const child = player!;
    const set = child.set.bind(child),
      fire = child.fire.bind(child);
    child.set = (...args) => {
      set(...args);
      owners.get(child)?.player?.onChange?.();
    };
    child.fire = (...args) => {
      fire(...args);
      owners.get(child)?.player?.onChange?.();
    };
  }
  player!.onChange = () => this.player?.onChange?.();
  return player!;
};

const instantiate = Icon.prototype.loadModel;
Icon.prototype.loadModel = function (source: Model) {
  prepareAssets();
  const base = origins.get(source) ?? source;
  const model = origins.has(source) && base.doc.assets ? hostEdit.compile!(base.doc).model! : base;
  origins.set(model, base);
  instantiate.call(this, model);
};

const load = Icon.prototype.load;
Icon.prototype.load = function (source, markup = false) {
  if ((source as Model)?.inputs instanceof Map) {
    this.loadModel(source as Model);
    return [];
  }
  const component = this.getAttribute('component');
  if (!component) return load.call(this, source, markup);
  let doc: Record<string, unknown>;
  try {
    if (typeof source === 'string') {
      if (markup) {
        const result = Icon.compiler?.(source);
        if (!result?.doc) return load.call(this, source, markup);
        doc = result.doc as Record<string, unknown>;
      } else doc = JSON.parse(source);
    } else doc = source as Record<string, unknown>;
  } catch {
    return load.call(this, source, markup);
  }
  return load.call(this, selectRoot(doc, component));
};
function selectRoot(doc: Record<string, unknown>, component: string): object {
  const definition = (doc.components as Record<string, object> | undefined)?.[component];
  if (!definition) {
    // Use the normal loader/diagnostic path, including its lifecycle and error event.
    return {
      ...doc,
      requires: [...new Set([...((doc.requires as string[]) ?? []), 'components'])],
      nodes: [{ id: 'root', type: 'instance', component }],
    };
  }
  return {
    anima: '0.1',
    name: component,
    requires: doc.requires,
    components: doc.components,
    ...(doc.data ? { data: doc.data } : {}),
    ...(doc.assets ? { assets: doc.assets } : {}),
    ...(doc.converters ? { converters: doc.converters } : {}),
    ...definition,
    ...(typeof (definition as { data?: unknown }).data === 'string'
      ? { data: { ...(doc.data as object), model: (definition as { data: string }).data } }
      : {}),
  };
}

declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    instance(id: string): Player;
  }
}

/** The registered constructor with the optional preload promise typed. */
export const AnimaIcon = Icon as typeof Icon & { readonly ready: Promise<void> };

// Cache source validation by URL, module generation and consumer policy. Rejected loads are retryable.
type Model = import('../../../packages/core/src/load.ts').Model;
const documents = new Map<IconType['assets'], Map<string, Promise<Model | string>>>();
const origins = new WeakMap<Model, Model>();
Icon.sourceLoader = async (icon, source) => {
  prepareAssets();
  const url = new URL(source, document.baseURI).href;
  let cache = documents.get(icon.assets);
  if (!cache) documents.set(icon.assets, (cache = new Map()));
  const component = icon.getAttribute('component');
  const key = JSON.stringify([url, icon.assetPolicy, component, Icon.registration]);
  let result = cache.get(key);
  if (!result) {
    result = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw Error('cannot fetch document');
      const text = await response.text();
      let parsed;
      try {
        parsed = /\.animl(?:[?#]|$)/.test(url)
          ? await (Icon.compilerAsync?.(text, url) ?? Icon.compiler?.(text))
          : { doc: JSON.parse(text) as object, diagnostics: [] };
      } catch {
        return text;
      }
      if (!parsed?.doc) return text;
      const compiled = hostEdit.compile!(
        component ? selectRoot(parsed.doc as Record<string, unknown>, component) : parsed.doc,
      );
      if (!compiled.model) return text;
      return compiled.model;
    })();
    cache.set(key, result);
    result.then(
      (value) => {
        if (typeof value === 'string') cache!.delete(key);
      },
      () => cache!.delete(key),
    );
  }
  return result;
};
const decoded = new WeakMap<Model, Promise<Record<string, Asset>>>();
let installed: typeof Icon.loadAssets;
function prepareAssets(): void {
  if (Icon.loadAssets === installed) return;
  const loadAssets = Icon.loadAssets;
  installed = Icon.loadAssets = async (icon, model) => {
    const assetsModule = Icon.modules.get('assets') as typeof assets | undefined;
    const base = origins.get(model);
    if (!base || !assetsModule || !loadAssets) return loadAssets?.(icon, model);
    let result = decoded.get(base);
    if (!result) {
      result = loadAssets(icon, model).then(() => assetsModule.resolvedAssets.get(model)!);
      decoded.set(base, result);
      result.catch(() => decoded.delete(base));
    }
    const records = await result;
    assetsModule.resolvedAssets.set(
      model,
      Object.fromEntries(Object.entries(records).map(([k, a]) => [k, { ...a }])),
    );
  };
}
