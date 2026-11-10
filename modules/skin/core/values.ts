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
        const grid = n.raw.mesh?.grid as number[] | undefined,
          at = (key: string) => player.prop(i, key) as number,
          base =
            String(n.type) === 'image'
              ? ((player.prop(i, 'mesh.vertex.' + k) as [number, number]) ??
                // A grid vertex follows the resolved (possibly animated) image box, as drawing does.
                (grid
                  ? [
                      at('x0') + (at('width') * (k % (grid[0]! + 1))) / grid[0]!,
                      at('y0') + (at('height') * Math.floor(k / (grid[0]! + 1))) / grid[1]!,
                    ]
                  : rest))
              : rest;
        const local = move(player, i, k, 'point', base, s),
          worldMatrix = rigContext(player)?.rest(i) ?? player.world(i),
          world = apply(worldMatrix, local[0], local[1]);
        out[n.id + '.skin.point.' + k] = world;
      });
    }
  });
}
