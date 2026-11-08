import type { ObjShape } from '../../../packages/core/src/registry.ts';
import type { NodeField } from '../../../packages/markup/src/names.ts';
export const layoutMarkup = {
  fields(fields: NodeField[], shape: ObjShape): void {
    const layout = shape.p.layout;
    if (layout?.k !== 'obj') return;
    for (const [key, shape] of Object.entries(layout.p))
      if (!fields.some((f) => f.attr === (shape.markup ?? key)))
        fields.push({ attr: shape.markup ?? key, path: ['layout', key], shape });
    for (const f of fields)
      if (['gap', 'padding', 'margin'].includes(f.attr)) f.shape = { k: 'arr', of: { k: 'num' } };
  },
};
