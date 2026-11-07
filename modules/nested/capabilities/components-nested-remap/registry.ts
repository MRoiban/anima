import type { ModuleEntry } from '../../../../packages/core/src/modules.ts';
const name = /^[a-z][a-zA-Z0-9-]*$/;
export const entries: ModuleEntry[] = [
  {
    target: 'instance',
    shapes: {
      component: { k: 'str', feature: 'components', re: /^(?:[a-z][a-zA-Z0-9-]*|\$[\w:.-]+)$/ },
      time: { k: 'alt', of: [{ k: 'num', min: 0 }, { k: 'str' }] },
      fps: { k: 'num', gt: 0 },
      size: {
        k: 'tup',
        min: 2,
        of: [
          { k: 'num', min: 0 },
          { k: 'num', min: 0 },
        ],
      },
      fit: {
        k: 'str',
        of: ['contain', 'cover', 'fill', 'none', 'scale-down', 'fit-width', 'fit-height'],
      },
      align: {
        k: 'str',
        of: [
          'center',
          'top-left',
          'top',
          'top-right',
          'left',
          'right',
          'bottom-left',
          'bottom',
          'bottom-right',
        ],
      },
    },
  },
  {
    target: 'document',
    shapes: {
      outputs: { k: 'map', key: name, of: { k: 'str' }, markup: 'outputs' },
    },
    elements: {
      output: {
        shape: {
          k: 'obj',
          req: ['name', 'value'],
          p: { name: { k: 'str', re: name }, value: { k: 'str' } },
        },
      },
    },
  },
];
