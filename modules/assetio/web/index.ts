import '../../../packages/web/src/index.ts';
import { resolvedAssets, imagePixels, type Asset } from '../../assets/core/index.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
const policies = new WeakMap<AnimaIcon, 'local' | 'any'>();
Object.defineProperty(Icon.prototype, 'assetPolicy', {
  get(this: AnimaIcon) {
    return policies.get(this) ?? 'local';
  },
  set(this: AnimaIcon, value: 'local' | 'any') {
    if (value !== 'local' && value !== 'any')
      throw new RangeError('assetPolicy must be local or any');
    policies.set(this, value);
  },
});
Icon.prototype.resolveAsset = async function (name, info) {
  const resolver = this.assets;
  const resolved = resolver ? await resolver.call(this, name, structuredClone(info)) : info.source;
  if (resolved instanceof Blob) return resolved;
  const base = this.getAttribute('src');
  const url = new URL(resolved, base ? new URL(base, document.baseURI).href : document.baseURI);
  if (
    !resolver &&
    (!['http:', 'https:', 'data:', 'blob:'].includes(url.protocol) ||
      (this.assetPolicy !== 'any' && url.protocol !== 'data:' && url.origin !== location.origin))
  )
    throw new Error('asset policy rejects source; use a resolver or assetPolicy=any');
  return url.href;
};
Icon.loadAssets = async (icon, model) => {
  const seen = new Map<object, Record<string, Asset>>();
  const load = async (model: NonNullable<AnimaIcon['player']>['model']): Promise<void> => {
    if (seen.has(model.doc)) return;
    const records: Record<string, Asset> = Object.fromEntries(
      Object.entries(model.doc.assets as Record<string, Asset>).map(([k, a]) => [k, { ...a }]),
    );
    seen.set(model.doc, records);
    resolvedAssets.set(model, records);
    await Promise.all(
      Object.entries(records).map(async ([name, asset]) => {
        // Images preload; media byte access and event audio remain lazy.
        if (asset.type !== 'image') return;
        let objectURL: string | undefined;
        try {
          const resolved = await icon.resolveAsset(name, asset);
          const source =
            resolved instanceof Blob ? (objectURL = URL.createObjectURL(resolved)) : resolved;
          const image = new Image();
          image.src = source;
          await image.decode();
          imagePixels.set(asset, [image.naturalWidth, image.naturalHeight]);
          // Blob URLs cannot outlive this load. Convert them to self-contained data instead.
          asset.source =
            resolved instanceof Blob
              ? await new Promise<string>((res, rej) => {
                  const reader = new FileReader();
                  reader.onload = () => res(String(reader.result));
                  reader.onerror = rej;
                  reader.readAsDataURL(resolved);
                })
              : source;
          asset.width ??= image.naturalWidth;
          asset.height ??= image.naturalHeight;
        } catch {
          throw [
            {
              code: 'asset-load',
              severity: 'error',
              pointer: '/assets/' + name.replace(/~/g, '~0').replace(/\//g, '~1') + '/source',
              message: `cannot load image asset ${name}`,
              hint: 'check the source or icon.assets resolver',
            },
          ];
        } finally {
          if (objectURL) URL.revokeObjectURL(objectURL);
        }
      }),
    );
    const components = Icon.modules.get('components') as
      import('../../components/core/index.ts').ComponentModule | undefined;
    await Promise.all(
      model.nodes.flatMap((n) => [...(components?.placements.get(n)?.values() ?? [])]).map(load),
    );
  };
  await load(model);
  return initialize(seen);
};
// A separate closure captures only catalogs; cached initializers must not retain a host element.
function initialize(records: Map<object, Record<string, Asset>>): (player: Player) => boolean {
  return (player) => {
    if (resolvedAssets.has(player)) return false;
    resolvedAssets.set(player, records.get(player.model.doc)!);
    return true;
  };
}
