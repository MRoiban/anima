import type { ModuleEntry } from '../../../packages/core/src/modules.ts';
import type { Shape } from '../../../packages/core/src/registry.ts';
const str: Shape = { k: 'str' },
  num: Shape = { k: 'num' },
  bool: Shape = { k: 'bool' };
const names: Shape = { k: 'alt', of: [str, { k: 'arr', of: str, min: 1 }] };
export const action: Shape = {
  k: 'obj',
  p: {
    fire: names,
    set: { k: 'map', of: { k: 'alt', of: [num, bool] } },
    toggle: names,
    emit: str,
  },
};
export const source: Shape = {
  k: 'alt',
  of: [num, str, { k: 'obj', p: { bind: str }, req: ['bind'] }],
};
const operand: Shape = {
  k: 'alt',
  of: [
    num,
    bool,
    {
      k: 'obj',
      p: {
        artboard: { k: 'str', of: ['width', 'height', 'aspect'] },
        component: str,
        focus: str,
      },
    },
  ],
};
export const entries: ModuleEntry[] = [
  { target: 'document', shapes: { machineSeed: { k: 'num', int: true, min: 0, max: 4294967295 } } },
  {
    target: 'state',
    shapes: {
      kind: { k: 'str', of: ['entry', 'exit', 'any', 'random'] },
      reset: bool,
      enterActions: action,
      exitActions: action,
      mix: {
        k: 'obj',
        p: {
          mode: { k: 'str', of: ['1d', 'direct', 'additive'] },
          axis: source,
          exit: { k: 'num', min: 0, int: true },
          children: {
            k: 'arr',
            min: 1,
            of: {
              k: 'obj',
              p: {
                play: str,
                at: num,
                weight: source,
              },
              req: ['play'],
            },
          },
        },
        req: ['mode', 'children'],
      },
    },
  },
  {
    target: 'transition',
    shapes: {
      disabled: bool,
      weight: { k: 'num', min: 0 },
      continue: bool,
      exitRatio: { k: 'num', min: 0, max: 1 },
      blendRatio: { k: 'num', min: 0 },
      actions: action,
      endActions: action,
      change: {
        k: 'obj',
        p: { input: str, mode: { k: 'str', of: ['changed', 'increased', 'decreased'] } },
        req: ['input', 'mode'],
      },
      guard: {
        k: 'obj',
        p: {
          left: operand,
          right: operand,
          op: { k: 'str', of: ['==', '!=', '<', '<=', '>', '>='] },
        },
        req: ['left', 'right', 'op'],
      },
    },
  },
];
