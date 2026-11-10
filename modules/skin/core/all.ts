import type { Module } from '../../../packages/core/src/modules.ts';
import { skin as base, type SkinModule } from './index.ts';
import { automatic } from './auto.ts';
import { skinDash } from './dash.ts';
import { meshRest, skinMeshPoints } from './mesh.ts';
import { installValues } from './values.ts';

export const skin: Module = {
  ...base,
  init(registry, shared) {
    const active = (base.init?.call(base, registry, shared) ?? base) as SkinModule,
      extensions = active.x!;
    extensions[0] = automatic;
    extensions[1] = meshRest;
    extensions[2] = skinMeshPoints;
    extensions[3] = true;
    installValues(shared);
    return { ...active, init: undefined, draw: skin.draw };
  },
  draw: {
    ...base.draw,
    frame(p, i, node, entry, frame) {
      base.draw?.frame?.(p, i, node, entry, frame);
      if (p.model.nodes[i]!.raw.skin) skinDash(i, node, frame);
    },
  },
};
