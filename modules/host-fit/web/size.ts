import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import type { HostLayoutPlayer } from './index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
export const sizes = new WeakMap<AnimaIcon, [number, number]>();
export const refresh = (icon: AnimaIcon) => {
  icon.attributeChangedCallback('fit', null, icon.getAttribute('fit'));
  if (icon.player) icon.invalidate();
};
Object.defineProperty(Icon.prototype, 'size', {
  get(this: AnimaIcon) {
    return [
      ...((this.fit === 'layout'
        ? (this.player as HostLayoutPlayer | undefined)?.layoutSize
        : undefined) ??
        sizes.get(this) ??
        this.player?.model.viewBox.slice(2) ?? [0, 0]),
    ];
  },
  set(this: AnimaIcon, value: [number, number]) {
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      ![...value].every((v) => Number.isFinite(v) && v > 0)
    ) {
      this.dispatchEvent(
        new CustomEvent('anima:error', {
          detail: [
            {
              code: 'host-size',
              severity: 'error',
              pointer: '',
              message: 'invalid artboard size',
              hint: 'set size to [width, height] with finite positive grid units',
            },
          ],
        }),
      );
      return;
    }
    sizes.set(this, [...value]);
    refresh(this);
  },
});
Icon.prototype.resetSize = function () {
  sizes.delete(this);
  refresh(this);
};
