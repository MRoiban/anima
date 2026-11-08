import type { ModuleEntry } from '../../../packages/core/src/modules.ts';
import type { Shape } from '../../../packages/core/src/registry.ts';
const number: Shape = { k: 'num' };
const size: Shape = { k: 'alt', of: [number, { k: 'str' }] };
const edges: Shape = { k: 'alt', of: [number, { k: 'arr', of: number, min: 1 }] };
export const axes = ['width', 'height'] as const;
export const bounds: Record<string, Shape> = {
  minWidth: { k: 'num', markup: 'min-width' },
  maxWidth: { k: 'num', markup: 'max-width' },
  minHeight: { k: 'num', markup: 'min-height' },
  maxHeight: { k: 'num', markup: 'max-height' },
};
export const alignments = ['start', 'center', 'end', 'stretch', 'baseline'];
export const childShape: Shape = {
  k: 'obj',
  markup: '',
  element: 'layout-item',
  p: {
    width: { ...size, markup: 'layout-width' },
    height: { ...size, markup: 'layout-height' },
    ...bounds,
    alignSelf: { k: 'str', of: alignments, markup: 'align-self' },
    margin: edges,
    display: { k: 'str', of: ['flex', 'none'] },
    reflow: size,
  },
};
export const entries: ModuleEntry[] = [
  {
    target: 'layout',
    node: { painted: true },
    required: ['id', 'type'],
    shapes: {
      children: { k: 'arr', of: { k: 'node' } },
      width: size,
      height: size,
      ...bounds,
      direction: { k: 'str', of: ['row', 'column', 'row-reverse', 'column-reverse'] },
      justify: {
        k: 'str',
        of: ['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'],
      },
      align: { k: 'str', of: alignments },
      gap: edges,
      padding: edges,
      reflow: size,
      corners: { k: 'num', min: 0 },
    },
  },
  { target: 'node', shapes: { layout: childShape } },
];
