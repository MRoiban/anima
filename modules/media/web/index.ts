import '../../assets/web/index.ts';
import { media } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';

declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    asset(name: string): Promise<ArrayBuffer | string>;
  }
}
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(media);
const caches = new WeakMap<object, Map<string, Promise<ArrayBuffer | string>>>();
Icon.prototype.asset = function (name) {
  const model = this.player?.model;
  if (!model || !Object.hasOwn(model.doc.assets ?? {}, name))
    return Promise.reject(new RangeError('unknown asset ' + name));
  let cache = caches.get(model);
  if (!cache) caches.set(model, (cache = new Map()));
  let result = cache.get(name);
  if (!result) {
    result = (async () => {
      const info = model.doc.assets[name];
      if (info.type === 'image') {
        const loaded = (
          Icon.modules.get('assets') as typeof import('../../assets/core/index.ts').assets
        ).resolvedAssets.get(model)?.[name];
        if (loaded) return loaded.source;
      }
      try {
        const source = await this.resolveAsset(name, info);
        if (info.type === 'image' || info.type === 'font') {
          if (typeof source !== 'string') throw Error('use an image resolver for Blob images');
          return source;
        }
        if (source instanceof Blob) return source.arrayBuffer();
        const response = await fetch(source);
        if (!response.ok) throw Error('HTTP ' + response.status);
        return response.arrayBuffer();
      } catch {
        cache!.delete(name);
        const diagnostics = [
          {
            code: 'asset-load',
            severity: 'error',
            pointer: '/assets/' + name.replaceAll('~', '~0').replaceAll('/', '~1') + '/source',
            message: 'cannot load media asset ' + name,
            hint: 'check source, assetPolicy and icon.assets resolver',
          },
        ];
        this.dispatchEvent(new CustomEvent('anima:error', { detail: diagnostics }));
        throw diagnostics;
      }
    })();
    cache.set(name, result);
  }
  return result;
};
