import type { LayoutElement } from '../../../packages/markup/src/layout.ts';
// seam(P6-4a): compiler-only hooks live apart from decompiler helpers for tree shaking.
import { eventsMarkup as compiler } from '../../markup-hooks/markup/events.ts';
export const eventsMarkup = {
  ...compiler,
  definitions(d: Record<string, unknown>): LayoutElement[] {
    return [
      ...Object.entries((d.audioVolumes ?? {}) as Record<string, number>)
        .filter(([k]) => k !== '$comment')
        .map(([name, v]): LayoutElement => ({
          name: 'audio-volume',
          attrs: [
            ['asset', name],
            ['value', String(v)],
          ],
          children: [],
        })),
      ...Object.entries((d.eventDefs ?? {}) as Record<string, Record<string, unknown>>)
        .filter(([k]) => k !== '$comment')
        .map(([name, def]): LayoutElement => ({
          name: 'event-def',
          attrs: [
            ['name', name],
            ...Object.entries(def).map(([k, v]): [string, string] => [
              k,
              k === 'payload' ? JSON.stringify(v) : String(v),
            ]),
          ],
          children: [],
        })),
    ];
  },
};
