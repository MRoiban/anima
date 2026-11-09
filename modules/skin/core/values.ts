import type { ModuleRegistry } from '../../../packages/core/src/modules.ts';
import { apply } from '../../../packages/core/src/geom.ts';
import { data, move, rigContext } from './index.ts';

export function installValues(shared: ModuleRegistry): void {
  const values = shared.Player.prototype.values;
  if ((shared.Player.prototype as unknown as { skinValues?: boolean }).skinValues) return;
  (shared.Player.prototype as unknown as { skinValues?: boolean }).skinValues = true;
  shared.Player.prototype.values = function () {
    const out = values.call(this);
    for (const [i, n] of this.model.nodes.entries()) {
      const s = data.get(n.raw);
      if (!s) continue;
      s.rest.forEach((rest, k) => {
        const base =
            String(n.type) === 'image'
              ? ((this.prop(i, 'mesh.vertex.' + k) as [number, number]) ?? rest)
              : rest,
          local = move(this, i, k, 'point', base, s),
          worldMatrix = rigContext(this)?.rest(i) ?? this.world(i),
          world = apply(worldMatrix, local[0], local[1]);
        out[n.id + '.skin.point.' + k] = world;
      });
    }
    return out;
  };
}
