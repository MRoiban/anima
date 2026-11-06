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
hostEdit.replaceImage = async (api, path, value) => {
  const icon = owners.get(api.player);
  const id = api.image(path).value;
  const assetsModule = Icon.modules.get('assets') as typeof assets | undefined;
  const records = assetsModule?.resolvedAssets.get(api.player.model);
  const record = records?.[id];
  if (!icon || !record || record.type !== 'image')
    fail('asset', path, 'image property must point at a loaded image asset');
  if (!(value instanceof Blob) && typeof value !== 'string')
    fail('type', path, 'image replacement must be an asset name, URL or Blob');
  let pending = versions.get(api.player);
  if (!pending) versions.set(api.player, (pending = new Map()));
  const revision = (pending.get(id) ?? 0) + 1;
  pending.set(id, revision);
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
      if (pending!.get(id) !== revision || icon.player !== api.player) return;
      records![id] = {
        ...record,
        source,
        width: image.naturalWidth,
        height: image.naturalHeight,
      } as Asset;
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

const load = Icon.prototype.load;
Icon.prototype.load = function (source, markup = false) {
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
  const definition = (doc.components as Record<string, object> | undefined)?.[component];
  if (!definition) {
    // Use the normal loader/diagnostic path, including its lifecycle and error event.
    return load.call(this, {
      ...doc,
      requires: [...new Set([...((doc.requires as string[]) ?? []), 'components'])],
      nodes: [{ id: 'root', type: 'instance', component }],
    });
  }
  return load.call(this, {
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
  });
};

declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    instance(id: string): Player;
  }
}

/** The registered constructor with the optional preload promise typed. */
export const AnimaIcon = Icon as typeof Icon & { readonly ready: Promise<void> };
