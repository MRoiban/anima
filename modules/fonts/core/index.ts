import type { Module } from '../../../packages/core/src/modules.ts';
import type { HostData } from '../../host/core/api.ts';
import { after } from '../manifest.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { installOptions } from './options.ts';
export { cssFont, type FontStyle } from './css.ts';
export interface FontModule extends Module {
  /** Compose the text registry and retain its live measurer setter. */
  use: (
    entries: import('../../../packages/core/src/modules.ts').ModuleEntry[],
    set: typeof import('../../text/core/measure.ts').registerTextMeasurer,
  ) => void;
  setMeasurer?: typeof import('../../text/core/measure.ts').registerTextMeasurer;
  refreshText?: (player: import('../../../packages/core/src/player.ts').Player) => void;
  prepareText?: (
    player: import('../../../packages/core/src/player.ts').Player,
    input: import('../../text/core/layout.ts').LayoutInput,
  ) => { revision: number; layout?: import('../../text/core/layout.ts').TextLayout } | undefined;
  accepts?: (face: unknown) => face is object;
  assign?: (api: HostData, path: string, face: object) => Promise<void>;
}
export const fonts: FontModule = {
  name: 'fonts',
  after: [...after, 'hostedit'],
  entries: [],
  use(entries, set) {
    fonts.setMeasurer = set;
    const entry = entries[0]!;
    const fields = [
      (entry.shapes.styles as { of: import('../../../packages/core/src/registry.ts').ObjShape }).of
        .p,
      entry.elements!.style!.shape.p,
    ];
    const tags = {
      k: 'map' as const,
      of: { k: 'num' as const },
      key: /^[a-zA-Z0-9 ]{4}$/,
      feature: 'fonts',
    };
    for (const field of fields)
      Object.assign(field, {
        axes: tags,
        features: { ...tags, of: { k: 'num', min: 0, int: true } },
      });
  },
  init(_registry, shared) {
    if (V) installOptions(fonts);
    const get = Object.getOwnPropertyDescriptor(shared.Player.prototype, 'data')?.get;
    if (get) {
      const seen = new WeakSet<HostData>();
      Object.defineProperty(shared.Player.prototype, 'data', {
        configurable: true,
        get() {
          const api = get.call(this) as HostData;
          if (!seen.has(api)) {
            seen.add(api);
            const font = api.font.bind(api);
            api.font = (path) => {
              const handle = font(path),
                set = handle.set as (value: unknown) => void;
              handle.set = (value) =>
                fonts.accepts?.(value) ? fonts.assign?.(api, path, value) : set(value);
              return handle;
            };
          }
          return api;
        },
      });
    }
    return fonts;
  },
};
