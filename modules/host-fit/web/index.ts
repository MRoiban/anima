import { contentBox } from '../../../packages/web/src/content-box.ts';
import { sizes, refresh } from './size.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
const observers = new WeakMap<AnimaIcon, ResizeObserver>();
const previous = Icon.eventHook;
Icon.eventHook = (icon, kind, detail) => {
  previous?.(icon, kind, detail);
  if (kind === 'cleanup') {
    observers.get(icon)?.disconnect();
    observers.delete(icon);
  }
};
// Root layout sizes are grid units: fit="layout" uses one CSS pixel per grid unit.
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
Icon.viewBox = (icon, svg) => {
  const m = icon.player?.model;
  if (!m) return;
  if (!observers.has(icon) && icon.isConnected) {
    const observer = new ResizeObserver(() => refresh(icon));
    observers.set(icon, observer);
    observer.observe(icon);
  }
  const fit = icon.getAttribute('fit');
  const { width, height, left, top } = contentBox(icon);
  if (!(width > 0 && height > 0)) return;
  const [x, y, w, h] = m.viewBox;
  const player = icon.player! as typeof icon.player & HostLayoutPlayer;
  const target: [number, number] | undefined = fit === 'layout' ? [width, height] : sizes.get(icon);
  if (String(target) !== String(player.layoutSize)) {
    player.layoutSize = target;
    // Re-step only when the layout module is registered.
    if ((player as { layoutBox?: unknown }).layoutBox) {
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
    svg.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px;overflow:hidden`;
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
