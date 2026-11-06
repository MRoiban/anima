import type { ModuleEntry } from '../../../packages/core/src/modules.ts';
import type { Shape } from '../../../packages/core/src/registry.ts';
const n: Shape = { k: 'num' };
export const entries: ModuleEntry[] = [
  {
    target: 'node',
    elements: {
      channel: {
        shape: {
          k: 'obj',
          p: { name: { k: 'str' }, type: { k: 'str' }, value: { k: 'any' } },
          req: ['name', 'type', 'value'],
        },
      },
      machine: { shape: { k: 'obj', p: { name: { k: 'str' } }, req: ['name'] } },
    },
    shapes: {
      pivotX: n,
      pivotY: n,
      channels: {
        k: 'map',
        key: /^[a-z][a-zA-Z0-9-]*$/,
        of: {
          k: 'obj',
          p: {
            type: { k: 'str', of: ['int', 'uint', 'string', 'reference'] },
            value: { k: 'alt', of: [n, { k: 'str' }] },
          },
          req: ['type', 'value'],
        },
        element: 'channel',
      },
    },
    props: { pivotX: { type: 'number', def: 0 }, pivotY: { type: 'number', def: 0 } },
  },
  {
    target: 'timeline',
    shapes: { speed: n, quantize: { k: 'num', gt: 0 }, work: { k: 'tup', of: [n, n], min: 2 } },
  },
  { target: 'state', shapes: { speed: { k: 'num', feature: '' } } },
  {
    target: 'transition',
    shapes: { exit: { k: 'num', min: 0 }, exitFraction: { k: 'num', min: 0, max: 1 } },
  },
];
