import type { ObjShape, Shape } from '../../../packages/core/src/registry.ts';
import type { ModuleEntry } from '../../../packages/core/src/modules.ts';
export const states =
  'checked pressed selected expanded disabled hidden required readonly modal'.split(' ');
export const roles =
  'button checkbox switch radio radio-group slider tab tab-list link list list-item group dialog alert-dialog heading text img none'.split(
    ' ',
  );
const str: Shape = { k: 'str' };
const bool: Shape = { k: 'alt', of: [{ k: 'bool' }, str] };
export const shape: ObjShape = {
  k: 'obj',
  element: 'a11y',
  req: ['role'],
  p: {
    role: { k: 'str', of: roles },
    label: str,
    hint: str,
    value: str,
    level: { k: 'num', int: true, min: 1, max: 6 },
    href: str,
    activate: str,
    ...Object.fromEntries(states.map((k) => [k, bool])),
    checkedMixed: { ...bool, markup: 'checked-mixed' },
    live: { k: 'str', of: ['off', 'polite', 'assertive'] },
    min: { k: 'num' },
    max: { k: 'num' },
    step: { k: 'num', gt: 0 },
    bounds: {
      k: 'tup',
      min: 4,
      of: [{ k: 'num' }, { k: 'num' }, { k: 'num', min: 0 }, { k: 'num', min: 0 }],
    },
  },
};
export const entries: ModuleEntry[] = [
  {
    target: 'node',
    shapes: { a11y: shape },
    elements: {
      a11y: { shape, target: { attribute: 'property', choices: ['a11y'], default: 'a11y' } },
    },
  },
];
