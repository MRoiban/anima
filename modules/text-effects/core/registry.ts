import type { ModuleEntry } from '../../../packages/core/src/modules.ts';
import type { ObjShape, Shape } from '../../../packages/core/src/registry.ts';
const n = (min?: number, max?: number): Shape => ({ k: 'num', min, max });
const s = (of?: string[], markup?: string): Shape => ({ k: 'str', of, markup });
export const rangeShape: ObjShape = {
  k: 'obj',
  element: 'text-range',
  p: {
    start: n(0),
    end: n(0),
    units: s(['glyphs', 'words', 'lines']),
    falloff: n(0),
    ease: s(),
    combine: s(['add', 'intersect', 'subtract', 'max', 'replace']),
    run: s(),
  },
};
export const effectShape: ObjShape = {
  k: 'obj',
  element: 'text-effect',
  p: {
    ...rangeShape.p,
    x: n(),
    y: n(),
    rotate: n(),
    scaleX: { ...n(), markup: 'scale-x' },
    scaleY: { ...n(), markup: 'scale-y' },
    opacity: n(0, 1),
    amount: n(0, 1),
    originX: { ...n(), markup: 'origin-x' },
    originY: { ...n(), markup: 'origin-y' },
    axes: { k: 'map', of: n(), key: /^[\x20-\x7e]{4}$/ },
    followPath: { ...s(), markup: 'follow-path' },
    pathOffset: { ...n(), markup: 'path-offset' },
    ranges: { k: 'arr', of: rangeShape },
  },
};
export const entries: ModuleEntry[] = [
  {
    target: 'text',
    shapes: {
      effects: { k: 'arr', of: effectShape, markup: 'text-effects' },
      background: {
        k: 'map',
        of: { k: 'alt', of: [s(), { k: 'obj', req: ['color'], p: { color: s(), radius: n(0) } }] },
      },
      direction: s(['auto', 'ltr', 'rtl']),
    },
    elements: {
      'text-effect': {
        shape: effectShape,
        target: { attribute: 'target', default: 'effects', choices: ['effects'], array: true },
      },
      'text-range': { shape: rangeShape },
    },
  },
];
