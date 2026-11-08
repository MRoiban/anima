// Optional text consumer integration, split from resources to retain fonts' 2 KB cap.
import './index.ts';
import { prepareText } from './text.ts';
import type { FontModule } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';
import type { Player } from '../../../packages/core/src/player.ts';
const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
const fonts = Icon.modules.get('fonts') as FontModule;
if (!fonts.prepareText) {
  const eachPlayer = (player: Player, visit: (player: Player) => void) => {
    visit(player);
    const nested = (player.nested as { players?: Map<string, Player> } | undefined)?.players;
    const lists = Icon.modules.get('lists') as
      typeof import('../../lists/core/index.ts').lists | undefined;
    for (const child of [
      ...(nested?.values() ?? []),
      ...(lists?.listState(player)?.runs.flatMap((r) => r.items.map((i) => i.player)) ?? []),
    ])
      eachPlayer(child, visit);
  };
  fonts.refreshText = (player) => eachPlayer(player, (p) => p.drawVersions.fill(++p.drawRevision));
  const hosts = new Set<WeakRef<AnimaIcon>>();
  const seen = new WeakSet<AnimaIcon>();
  const previousHook = Icon.eventHook;
  Icon.eventHook = (icon, kind, info) => {
    if (!seen.has(icon)) {
      seen.add(icon);
      hosts.add(new WeakRef(icon));
    }
    previousHook?.(icon, kind, info);
  };
  const owners = new WeakMap<Player, AnimaIcon>();
  const previous = Icon.loadAssets;
  Icon.loadAssets = async (icon, model) => {
    const prior = await previous?.(icon, model);
    // Non-font documents share cached initializers; do not retain a host in that cache.
    if (!model.doc.requires?.includes('fonts')) return prior;
    return (player) => {
      owners.set(player, icon);
      return prior?.(player) ?? false;
    };
  };
  fonts.prepareText = prepareText(
    (player) => {
      if (!owners.has(player))
        for (const ref of hosts) {
          const host = ref.deref();
          if (!host) hosts.delete(ref);
          else if (host.player) eachPlayer(host.player, (p) => owners.set(p, host));
        }
      return owners.get(player);
    },
    Icon,
    (player) => fonts.refreshText!(player),
  );
}
