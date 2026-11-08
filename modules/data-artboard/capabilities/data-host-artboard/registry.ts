import type { ModuleEntry } from '../../../../packages/core/src/modules.ts';
export const entries: ModuleEntry[] = [
  {
    target: 'document',
    shapes: {},
    elements: {
      artboard: {
        shape: {
          k: 'obj',
          req: ['name'],
          p: {
            name: { k: 'str' },
            default: { k: 'str' },
            model: { k: 'str' },
            public: { k: 'bool' },
          },
        },
      },
    },
  },
];
