import '../../assetio/web/index.ts';
import { assets, type Asset } from '@anima-format/core/assets';
import { assetsSVG } from '@anima-format/core/assets-svg';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';

declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    assetPolicy: 'local' | 'any';
    resolveAsset(name: string, info: Readonly<Asset>): Promise<string | Blob>;
    assets?: (name: string, info: Readonly<Asset>) => string | Blob | Promise<string | Blob>;
  }
}
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(assets);
Icon.registerSVGBackend('assets', assetsSVG);
