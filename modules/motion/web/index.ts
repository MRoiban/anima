import { motion } from '../core/index.ts';
import type { MotionAPI } from '../core/api.ts';
import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
Icon.registerModule(motion);
// Methods bind to the current player on every access; retained handles belong to that load.
for (const key of [
  'timeline',
  'createTimeline',
  'machine',
  'node',
  'seek',
  'scrub',
  'applyTimeline',
] as const)
  Object.defineProperty(Icon.prototype, key, {
    configurable: true,
    value: function (this: AnimaIcon, ...args: unknown[]) {
      if (!this.player) throw Error('anima: empty icon');
      return Reflect.apply(this.player[key], this.player, args);
    },
  });
Object.defineProperty(Icon.prototype, 'animations', {
  configurable: true,
  get(this: AnimaIcon) {
    return this.player?.animations ?? [];
  },
});
declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon extends MotionAPI {
    readonly animations: MotionAPI['animations'];
  }
}
