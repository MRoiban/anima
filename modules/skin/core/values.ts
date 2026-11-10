import type { ModuleRegistry } from '../../../packages/core/src/modules.ts';
import { apply } from '../../../packages/core/src/geom.ts';
import { data, move, rigContext } from './index.ts';
import { valueProviders } from '../../rig/core/api.ts';

export function installValues(_shared: ModuleRegistry): void {
  valueProviders.set('skin', (player, out) => {
    for (const [i, n] of player.model.nodes.entries()) {
      const s = data.get(n.raw);
      if (!s) continue;
      s.rest.forEach((rest, k) => {
        const base =
          String(n.type) === 'image'
            ? ((player.prop(i, 'mesh.vertex.' + k) as [number, number]) ?? rest)
            : rest;
        // Automatic weights are cached per vertex: compute them from the rest vertex, as drawing does.
        if (!s.weights) move(player, i, k, 'point', rest, s);
        const local = move(player, i, k, 'point', base, s),
          worldMatrix = rigContext(player)?.rest(i) ?? player.world(i),
          world = apply(worldMatrix, local[0], local[1]);
        out[n.id + '.skin.point.' + k] = world;
      });
    }
  });
}
