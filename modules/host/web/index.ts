import '../../host-values/web/index.ts';
import { fail } from '../core/errors.ts';
import { host } from '../core/index.ts';
import type { HostData } from '../core/api.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(host);
const loaded = new WeakSet<object>();
function prepare(icon: AnimaIcon): void {
  const player = icon.player;
  if (!player || loaded.has(player)) return;
  loaded.add(player);
  if (icon.hasAttribute('auto-bind')) {
    const data = (
      Icon.modules.get('data') as import('../../data/core/index.ts').DataModule
    )?.dataState(player);
    if (data) player.data.bind(data.compiled.defaultName);
  }
}
Object.defineProperty(Icon.prototype, 'data', {
  configurable: true,
  get(this: AnimaIcon) {
    if (!this.player) fail('instance', '', 'icon has not loaded an instance');
    prepare(this);
    return this.player.data;
  },
});
// Prepare before the first draw/load callback, including paused and async-asset loads.
// Lazy access also covers a host bundle arriving after an already settled document.
const previous = Icon.eventHook;
Icon.eventHook = (icon, kind, detail) => {
  if (kind !== 'cleanup') prepare(icon);
  previous?.(icon, kind, detail);
};
declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    readonly data: HostData;
  }
}
