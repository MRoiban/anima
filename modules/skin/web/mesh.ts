import './index.ts';
import { meshRest, skinMeshPoints } from '../core/mesh.ts';
import type { SkinModule } from '../core/index.ts';
import type { AnimaIcon } from '../../../packages/web/src/index.ts';

(customElements.get('anima-icon') as typeof AnimaIcon).registerModule({
  name: 'skinmesh',
  after: ['skin'],
  entries: [],
  init(registry) {
    const extensions = (registry.get('skin') as SkinModule).x!;
    extensions[1] = meshRest;
    extensions[2] = skinMeshPoints;
    return this;
  },
});
