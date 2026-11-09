import './index.ts';
import { installPaintedBounds, boundsScales } from '../core/bounds.ts';
import type { a11y } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import type {} from '../../canvas/web/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
const runtime = (Icon.modules.get('a11y') as typeof a11y).runtime;
installPaintedBounds(runtime, Icon.modules);
const previous = Icon.eventHook;
const observers = new WeakMap<AnimaIcon, ResizeObserver>();
Icon.eventHook = (icon, kind, detail) => {
  if (kind === 'cleanup') {
    observers.get(icon)?.disconnect();
    observers.delete(icon);
  }
  if (kind === 'draw' && icon.player?.model.doc.requires?.includes('a11y')) {
    const p = icon.player!;
    if (!observers.has(icon) && icon.isConnected) {
      const observer = new ResizeObserver(() => icon.invalidate());
      observer.observe(icon);
      observers.set(icon, observer);
    }
    const c = Icon.canvasBox?.(icon, [0, 0, 1, 1]);
    const m = icon.shadowRoot!.querySelector('svg')?.getScreenCTM();
    const scale: [number, number] = c ? [c.width, c.height] : m ? [m.a, m.d] : [1, 1];
    if (scale.every((s) => s > 0) && String(boundsScales.get(p)) !== String(scale)) {
      boundsScales.set(p, scale);
      runtime.caches.delete(p);
      queueMicrotask(() => icon.invalidate());
    }
  }
  previous?.(icon, kind, detail);
};
for (const icon of document.querySelectorAll<AnimaIcon>('anima-icon')) icon.invalidate();
