import './index.ts';
import { enhanceField } from '../core/extra.ts';
import { config, type textinput } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
const module = Icon.modules.get('textinput') as typeof textinput;
module.setEnhancer(enhanceField);
const timers = new WeakMap<AnimaIcon, { stop: () => void; key: string }>();
const previous = Icon.eventHook;
Icon.eventHook = (icon, kind, info) => {
  previous?.(icon, kind, info);
  if (kind === 'cleanup' || kind === 'pause') {
    const p = icon.player,
      f = p?.focused ? module.field(p, p.focused) : undefined;
    if (f?.caretHidden) {
      f.caretHidden = false;
      p!.drawVersions.fill(++p!.drawRevision);
      icon.invalidate();
    }
    timers.get(icon)?.stop();
    timers.delete(icon);
    return;
  }
  if (kind !== 'draw') return;
  const p = icon.player!,
    id = p.focused,
    i = id ? p.model.ids.get(id) : undefined;
  const c = i === undefined ? undefined : config(p, i);
  const f = c && id ? module.field(p, id) : undefined;
  const blink =
    f &&
    f.start === f.end &&
    c?.caretBlink !== false &&
    !p.reducedMotion &&
    !icon.hasAttribute('paused') &&
    icon.isConnected;
  const key = blink ? `${id}:${f.revision ?? 0}:${f.value}` : '';
  if (timers.get(icon)?.key === key) return;
  timers.get(icon)?.stop();
  timers.delete(icon);
  if (f?.caretHidden) {
    f.caretHidden = false;
    p.drawVersions[i!] = ++p.drawRevision;
    icon.invalidate();
  }
  if (!blink || !f || i === undefined) return;
  let timer: ReturnType<typeof setTimeout>;
  const tick = () => {
    if (icon.player !== p || p.focused !== id || icon.hasAttribute('paused') || !icon.isConnected) {
      timers.delete(icon);
      f.caretHidden = false;
      return;
    }
    f.caretHidden = p.reducedMotion ? false : !f.caretHidden;
    p.drawVersions[i] = ++p.drawRevision;
    icon.invalidate();
    if (!p.reducedMotion) timer = setTimeout(tick, 530);
    else timers.delete(icon);
  };
  timers.set(icon, { key, stop: () => clearTimeout(timer) });
  timer = setTimeout(tick, 530);
};
