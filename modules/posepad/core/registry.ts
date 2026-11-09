import type { ModuleEntry } from '../../../packages/core/src/modules.ts';
export const entries: ModuleEntry[] = [
  {
    target: 'posepad',
    node: {},
    shapes: {
      timelineX: { k: 'str', markup: 'timeline-x' },
      timelineY: { k: 'str', markup: 'timeline-y' },
      invertX: { k: 'bool', markup: 'invert-x' },
      invertY: { k: 'bool', markup: 'invert-y' },
      handle: { k: 'str' },
      box: {
        k: 'tup',
        of: [{ k: 'num' }, { k: 'num' }, { k: 'num', gt: 0 }, { k: 'num', gt: 0 }],
        min: 4,
      },
      valueX: { k: 'num', markup: 'value-x' },
      valueY: { k: 'num', markup: 'value-y' },
    },
    props: {
      valueX: { type: 'number', def: 0, min: -1, max: 1, markup: 'value-x' },
      valueY: { type: 'number', def: 0, min: -1, max: 1, markup: 'value-y' },
    },
  },
];
