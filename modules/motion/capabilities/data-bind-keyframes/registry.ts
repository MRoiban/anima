import type { ModuleEntry } from '../../../../packages/core/src/modules.ts';
// JSON keeps ordinary [time, value, ease?] tuples; AniML additionally accepts key elements.
export const entries: ModuleEntry[] = [
  {
    target: 'timeline',
    shapes: {},
    elements: {
      key: {
        shape: {
          k: 'obj',
          p: { t: { k: 'num' }, value: { k: 'any' }, ease: { k: 'str' } },
          req: ['t', 'value'],
        },
      },
    },
  },
];
