import type { ModuleEntry } from '../../../../packages/core/src/modules.ts';
import type { ObjShape, Shape } from '../../../../packages/core/src/registry.ts';
import { NAME } from '../../../../packages/core/src/registry.ts';
const names: Shape = {
  k: 'alt',
  of: [
    { k: 'str', re: NAME },
    { k: 'arr', of: { k: 'str', re: NAME } },
  ],
};
const action: ObjShape = {
  k: 'obj',
  p: {
    fire: names,
    toggle: names,
    emit: { k: 'str', re: NAME },
    set: {
      k: 'map',
      key: NAME,
      of: { k: 'alt', of: [{ k: 'num' }, { k: 'bool' }, { k: 'str' }] },
    },
  },
};
export const entries: ModuleEntry[] = [
  { target: 'state', shapes: { entry: action, exit: action } },
  { target: 'transition', shapes: { actions: action } },
];
