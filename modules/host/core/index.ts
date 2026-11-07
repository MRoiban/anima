import type { Module } from '../../../packages/core/src/modules.ts';
import type { DataModule } from '../../data/core/index.ts';
import { after } from '../manifest.ts';
import type { lists } from '../../lists/core/index.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { hostValues } from '../../host-values/core/index.ts';
import { install, observe } from './api.ts';
export * from './api.ts';
export const host: Module = {
  name: 'host',
  after: [...after, 'hostvalues'],
  entries: [],
  init(registry, shared) {
    const data = registry.get('data') as DataModule | undefined;
    const values = (registry.get('hostvalues') as typeof hostValues | undefined) ?? hostValues;
    install(
      shared,
      (player) => data?.dataState(player),
      values.Values,
      (p) => [
        ...((p.nested as { players?: Map<string, Player> } | undefined)?.players?.values() ?? []),
        ...((registry.get('lists') as typeof lists | undefined)
          ?.listState(p)
          ?.runs.flatMap((r) => r.items.map((i) => i.player)) ?? []),
      ],
    );
    return host;
  },
  load: observe,
};
