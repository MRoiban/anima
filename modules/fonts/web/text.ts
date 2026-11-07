import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import type { FontModule } from '../core/index.ts';
import type { LayoutInput, TextLayout } from '../../text/core/layout.ts';
import type { TextModule } from '../../text/core/index.ts';
import type { FontStyle } from '../core/css.ts';

/** Optional consumer hook: no text implementation is imported by the fonts entry. */
export function prepareText(
  owner: (player: Player) => AnimaIcon | undefined,
  Icon: typeof AnimaIcon,
  refresh: (player: Player) => void,
): NonNullable<FontModule['prepareText']> {
  const spec = (style: LayoutInput['styles'][string] = {}): FontStyle => ({
    family: style.font ?? 'sans-serif',
    size: style.size ?? 1,
    weight: style.weight ?? 400,
    style: style.style ?? 'normal',
    tracking: 0,
    axes: style.axes,
    features: style.features,
  });
  const states = new WeakMap<Player, Map<string, boolean>>();
  const empty: TextLayout = {
    lines: [],
    width: 0,
    height: 0,
    contentWidth: 0,
    contentHeight: 0,
    fittedSize: 0,
    scale: 1,
  };
  return (player, input: LayoutInput) => {
    if (!player.model.doc.requires?.includes('fonts')) return;
    const icon = owner(player);
    if (!icon) return;
    const controller = icon.fonts.forModel(player.model);
    input.styles[''] ??= {};
    const key = JSON.stringify([controller.revision, icon.fonts.revision, input]);
    let state = states.get(player);
    if (!state) states.set(player, (state = new Map()));
    if (!state.has(key)) {
      if (state.size > 64) state.clear();
      state.set(key, false);
      const specs = input.runs.map((run) => spec(input.styles[run.style ?? '']));
      void Promise.all(specs.map((spec, i) => controller.ready(spec, input.runs[i]!.text))).then(
        () => {
          if (!state.has(key) || !icon.player) return;
          state.set(key, true);
          (Icon.modules.get('text') as TextModule).invalidateText(player);
          refresh(icon.player);
          // Redraw without stepping: queued host input must remain queued, including on paused hosts.
          icon.attributeChangedCallback('renderer', null, icon.getAttribute('renderer'));
        },
      );
    }
    for (const style of Object.values(input.styles))
      style.font = controller.cssFont(spec(style)).fontFamily;
    return {
      revision: controller.revision + icon.fonts.revision,
      layout: state.get(key) ? undefined : empty,
    };
  };
}
