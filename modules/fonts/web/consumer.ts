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
  // Host cleanup (disconnect) releases named faces; the same player's next text use restores them.
  type Scope = {
    icon: AnimaIcon;
    families: Map<string, string>;
    faces: Set<FontFace>;
    children: Map<object, Scope>;
    fallback: string[];
    fallbackFaces: Set<FontFace>;
    retain(face: FontFace): void;
  };
  const parked = new WeakMap<object, () => void>();
  const snapshot = (s: Scope): (() => void) => {
    const families = new Map(s.families),
      faces = [...s.faces],
      fallback = [...s.fallback],
      fallbackFaces = new Set(s.fallbackFaces),
      children = [...s.children].map(([m, c]) => [m, c, snapshot(c)] as const);
    return () => {
      for (const face of faces) s.retain(face);
      s.families = new Map([...families, ...s.families]);
      // Child scopes do not preserve fallback through cleanup; the root already did.
      if (!s.fallback.length) {
        s.fallback = fallback;
        s.fallbackFaces = fallbackFaces;
      }
      for (const [m, c, restore] of children) {
        s.children.set(m, c);
        restore();
      }
    };
  };
  // Patch the live controller class: separately bundled entries carry their own copies.
  type Method = (this: Scope, arg?: never) => unknown;
  const proto = Object.getPrototypeOf(Reflect.get(Icon.prototype, 'fonts', {})) as Record<
    string,
    Method
  >;
  for (const name of ['forModel', 'cssFont']) {
    const method = proto[name]!;
    proto[name] = function (this: Scope, arg: unknown) {
      const root = this.icon.fonts as unknown as Scope;
      parked.get(root)?.();
      parked.delete(root);
      return method.call(this, arg as never);
    };
  }
  const clear = proto.clear!;
  proto.clear = function (this: Scope, keep?: boolean) {
    const player = this.icon.player,
      restore = snapshot(this),
      previous = parked.get(this);
    if (!keep) parked.delete(this);
    // Repeated cleanups before a use stack their snapshots; newer families win.
    else if (this.faces.size || this.families.size || !previous)
      parked.set(this, () => {
        if (player && this.icon.player === player) restore();
        previous?.();
      });
    return clear.call(this, keep as never);
  };
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
