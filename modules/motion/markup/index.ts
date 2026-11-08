import type { LayoutElement } from '../../../packages/markup/src/layout.ts';
// seam(P6-4a): compiler-only hooks live apart from decompiler helpers for tree shaking.
import { motionMarkup as compiler } from '../../markup-hooks/markup/motion.ts';
type Obj = Record<string, unknown>;
export const motionMarkup = {
  ...compiler,
  channels(n: Obj): LayoutElement[] {
    return Object.entries((n.channels ?? {}) as Record<string, { type: string; value: unknown }>)
      .filter(([n]) => n !== '$comment')
      .map(([name, c]) => ({
        name: 'channel',
        attrs: [
          ['name', name],
          ['type', c.type],
          ['value', typeof c.value === 'string' ? JSON.stringify(c.value) : String(c.value)],
        ],
        children: [],
      }));
  },
};
