import type { ModuleEntry } from '../../../../packages/core/src/modules.ts';
const path = { k: 'str' as const, re: /^\$[\w:.-]+$/ };
export const entries: ModuleEntry[] = [
  {
    target: 'repeat',
    node: {},
    required: ['id', 'type', 'component'],
    shapes: {
      list: path,
      count: path,
      component: { k: 'alt', of: [{ k: 'str' }, { k: 'map', of: { k: 'str' } }] },
      dx: { k: 'num' },
      dy: { k: 'num' },
      size: {
        k: 'tup',
        min: 2,
        of: [
          { k: 'num', min: 0 },
          { k: 'num', min: 0 },
        ],
      },
    },
  },
];
