import { assets, resolvedAssets, type Asset } from '@anima-format/core/assets';
import { assetsSVG } from '@anima-format/core/assets-svg';
import './index.ts';
import type { AnimaIcon } from './index.ts';

declare module './index.ts' {
  interface AnimaIcon {
    assets?: (name: string, info: Readonly<Asset>) => string | Blob | Promise<string | Blob>;
  }
}
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(assets);
Icon.registerSVGBackend('assets', assetsSVG);
Icon.loadAssets = async (icon, model) => {
  const records: Record<string, Asset> = Object.fromEntries(
    Object.entries(model.doc.assets as Record<string, Asset>).map(([k, a]) => [k, { ...a }]),
  );
  resolvedAssets.set(model, records);
  await Promise.all(
    Object.entries(records).map(async ([name, asset]) => {
      // Fonts/audio/blob are declarations only until their consumer modules ship.
      if (asset.type !== 'image') return;
      let objectURL: string | undefined;
      try {
        const info = { ...asset };
        const resolved = icon.assets ? await icon.assets(name, info) : asset.source;
        const source =
          resolved instanceof Blob
            ? (objectURL = URL.createObjectURL(resolved))
            : new URL(resolved, new URL(icon.getAttribute('src') ?? '', document.baseURI)).href;
        const image = new Image();
        image.src = source;
        await image.decode();
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
};
