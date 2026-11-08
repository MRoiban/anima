import './index.ts';
import { decodeFont, type FontInfo } from '../core/info.ts';
import { fault } from '../core/opentype/binary.ts';
import type { FontController } from './index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
export { decodeFont, FontInfo, type FontOptions } from '../core/info.ts';
async function bytes(
  controller: FontController,
  source: ArrayBuffer | string,
): Promise<ArrayBuffer> {
  if (typeof source !== 'string') return source.slice(0);
  const icon = (controller as unknown as { icon: AnimaIcon }).icon;
  const resolved = await icon.resolveAsset('', { type: 'font', source });
  try {
    const response = resolved instanceof Blob ? resolved : await fetch(resolved);
    if (response instanceof Response && !response.ok) throw Error();
    return await response.arrayBuffer();
  } catch {
    return fault('font fetch failed; check the source URL and asset policy', 'font-source');
  }
}
// Separately emitted resource/metadata bundles must extend the live controller prototype.
const prototype = Object.getPrototypeOf(
  document.createElement('anima-icon').fonts,
) as FontController;
if (!prototype.info) {
  const sources = new WeakMap<FontFace, ArrayBuffer>();
  const decode = prototype.decode;
  prototype.decode = async function (source, descriptors) {
    const snapshot = await bytes(this, source);
    const face = await decode.call(this, snapshot, descriptors);
    sources.set(face, snapshot);
    return face;
  };
  prototype.info = async function (source) {
    const snapshot =
      source instanceof FontFace
        ? (sources.get(source) ??
          fault(
            'font bytes are unavailable; decode through this controller or supply SFNT bytes',
            'font-source',
          ))
        : await bytes(this, source);
    return decodeFont(new Uint8Array(snapshot));
  };
}
declare module './index.ts' {
  interface FontController {
    info(source: FontFace | ArrayBuffer | string): Promise<FontInfo>;
  }
}
