import type { ElementForm, ObjShape, Shape } from '../../../../packages/core/src/registry.ts';
import type { ModuleEntry } from '../../../../packages/core/src/modules.ts';

const number: Shape = { k: 'num', min: 0, max: 1 };
const influences: Shape = { k: 'map', of: number };
export const skinShape: ObjShape = {
  k: 'obj',
  element: 'skin',
  p: {
    bones: { k: 'arr', min: 1, of: { k: 'str' } },
    weights: {
      k: 'arr',
      min: 1,
      of: { k: 'obj', p: { point: influences, in: influences, out: influences }, req: ['point'] },
    },
  },
  req: ['bones'],
};

const authoringShape: ObjShape = {
  k: 'obj',
  p: {
    bones: { k: 'arr', min: 1, of: { k: 'str' } },
    // The structural compiler parses this attribute as one JSON value; strict validation uses skinShape.
    weights: { k: 'alt', of: [{ k: 'arr', of: { k: 'any' } }] },
  },
  req: ['bones'],
};

export const skinElement: ElementForm = {
  shape: authoringShape,
  target: { attribute: 'into', default: 'skin', choices: ['skin'] },
};

export const entries: ModuleEntry[] = [{ target: 'node', shapes: { skin: skinShape } }];
