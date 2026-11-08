import '../../../packages/web/src/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
const observers = new WeakMap<AnimaIcon, ResizeObserver>();
const sizes = new WeakMap<AnimaIcon, [number, number]>();
const previous = Icon.eventHook;
Icon.eventHook = (icon, kind, detail) => {
  previous?.(icon, kind, detail);
  if (kind === 'cleanup') {
    observers.get(icon)?.disconnect();
    observers.delete(icon);
  }
};
const refresh = (icon: AnimaIcon) => {
  icon.attributeChangedCallback('fit', null, icon.getAttribute('fit'));
  if (icon.player) icon.invalidate();
};
// seam(P7-3): P7-2 consumes this per-player override for the root layout's width/height.
export interface HostLayoutPlayer {
  layoutSize?: [number, number];
  layoutBox?: (id: string) => unknown;
}
for (const name of ['fit', 'alignment'])
  Object.defineProperty(Icon.prototype, name, {
    get(this: AnimaIcon) {
      return this.getAttribute(name) ?? (name === 'fit' ? 'contain' : 'center');
    },
    set(this: AnimaIcon, value: string) {
      this.setAttribute(name, value);
    },
  });
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
Icon.viewBox = (icon, svg) => {
  const m = icon.player?.model;
  if (!m) return;
  if (!observers.has(icon) && icon.isConnected) {
    const observer = new ResizeObserver(() => refresh(icon));
    observers.set(icon, observer);
    observer.observe(icon);
  }
  const fit = icon.getAttribute('fit');
  const css = getComputedStyle(icon),
    width = parseFloat(css.width),
    height = parseFloat(css.height);
  if (!(width > 0 && height > 0)) return;
  const [x, y, w, h] = m.viewBox;
  const player = icon.player! as typeof icon.player & HostLayoutPlayer;
  const target: [number, number] | undefined = fit === 'layout' ? [width, height] : sizes.get(icon);
  if (String(target) !== String(player.layoutSize)) {
    player.layoutSize = target;
    if (player.layoutBox) {
      player.step(0);
      icon.invalidate();
    }
  }
  // Preserve the original grid/bleed viewport when no fit or size was requested (B8).
  if (!fit && !sizes.has(icon) && !icon.hasAttribute('alignment') && !icon.hasAttribute('align')) {
    svg?.setAttribute('viewBox', m.viewBox.join(' '));
    return;
  }
  const [sw, sh] = target ?? [w, h];
  let sx = width / sw,
    sy = height / sh;
  if (fit !== 'fill')
    sx = sy =
      fit === 'none' || fit === 'layout'
        ? 1
        : fit === 'fit-width'
          ? sx
          : fit === 'fit-height'
            ? sy
            : fit === 'scale-down'
              ? Math.min(1, sx, sy)
              : (fit === 'cover' ? Math.max : Math.min)(sx, sy);
  const requested = icon.getAttribute('alignment') ?? icon.getAttribute('align') ?? 'center';
  const alignment =
    /^(?:(?:top|center|bottom)-(?:left|center|right)|center|top|bottom|left|right)$/.test(requested)
      ? requested
      : 'center';
  const factor = (lo: string, hi: string) =>
    alignment.includes(lo) ? 0 : alignment.includes(hi) ? 1 : 0.5;
  const box = [
    x - (width / sx - sw) * factor('left', 'right'),
    y - (height / sy - sh) * factor('top', 'bottom'),
    width / sx,
    height / sy,
  ];
  if (svg) {
    svg.style.cssText = 'left:0;top:0;width:100%;height:100%;overflow:hidden';
    svg.setAttribute('viewBox', box.join(' '));
    svg.setAttribute('preserveAspectRatio', 'none');
  }
  return box;
};
for (const icon of document.querySelectorAll<AnimaIcon>('anima-icon')) refresh(icon);
declare module '../../../packages/web/src/index.ts' {
  interface AnimaIcon {
    fit: string;
    alignment: string;
    size: [number, number];
    resetSize(): void;
  }
}
