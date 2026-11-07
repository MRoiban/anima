// seam(P6-4a): retain the tooling API while browser hooks omit decompilation.
import { converterCompiler as compiler } from '../../markup-hooks/markup/convert.ts';
export { convertMarkup } from '../../markup-hooks/markup/convert.ts';
import { options } from '../core/registry.ts';
import type { LayoutElement } from '../../../packages/markup/src/layout.ts';
export const converterCompiler = {
  ...compiler,
  definitions(d: Record<string, unknown>): LayoutElement[] {
    return Object.entries((d.converters ?? {}) as Record<string, Record<string, unknown>>)
      .filter(([name]) => name !== '$comment')
      .map(([name, def]) => ({
        name: 'chain' in def ? 'converter-group' : 'converter',
        attrs: [
          ['name', name],
          ...Object.entries(def)
            .filter(([key]) => key !== '$comment')
            .map(([key, value]): [string, string] => [
              key,
              options[key]?.k === 'any'
                ? JSON.stringify(value)
                : Array.isArray(value)
                  ? value.join(' ')
                  : String(value),
            ]),
        ] as [string, string][],
        children: [],
      }));
  },
};
