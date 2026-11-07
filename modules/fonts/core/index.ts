import type { Module } from '../../../packages/core/src/modules.ts';
import type { HostData } from '../../host/core/api.ts';
import { after } from '../manifest.ts';
export { cssFont, type FontStyle } from './css.ts';
export const fonts: Module & {
  accepts?: (face: unknown) => face is object;
  assign?: (api: HostData, path: string, face: object) => Promise<void>;
} = {
  name: 'fonts',
  after: [...after, 'hostedit'],
  entries: [],
  init(_registry, shared) {
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
