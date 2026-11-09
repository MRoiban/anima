import type { Module } from '../../../packages/core/src/modules.ts';
import type { Player } from '../../../packages/core/src/player.ts';
import { outline } from './outline.ts';
import { flatten, parsePath } from '../../../packages/core/src/path.ts';

// Preserve paint's path commands and control arithmetic, including independent
// half-edge clamping (elliptical corners on non-square rects).
export function cornerPath(p: Player, i: number): string | undefined {
  const n = p.model.nodes[i]!,
    r = n.raw;
  if (n.type !== 'rect' || !r.corners) return;
  const box = (
    p as Player & { drawnLayoutBox?(id: string): Record<string, number> | undefined }
  ).drawnLayoutBox?.(n.id);
  const x = box ? 0 : r.x0,
    y = box ? 0 : r.y0,
    w = box ? box.width! : p.num(i, 'w', 0),
    h = box ? box.height! : p.num(i, 'h', 0);
  return outline(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    [0, 1, 2, 3].map((j) => p.num(i, 'corners.' + j, 0)),
    true,
  );
}
const radius = { k: 'num' as const, min: 0 };
export const cornerEntries: Module['entries'] = [
  {
    target: 'rect',
    shapes: {
      corners: {
        k: 'tup',
        of: [radius, radius, radius, radius],
        min: 4,
        feature: 'paint|corners',
      },
    },
  },
];
export const cornerModel: NonNullable<Module['model']> = (n, key) => {
  const m = /^corners\.([0-3])$/.exec(key);
  if (n.type === 'rect' && m && n.raw.corners)
    // The tuple's paint|corners gate is checked structurally. Numeric addresses
    // need no new value type; core's address gate predates alternative features.
    return { prop: { type: 'number', min: 0 }, rest: n.raw.corners[+m[1]!] };
};
export const corners: Module = {
  name: 'corners',
  entries: cornerEntries,
  model: cornerModel,
  outline(p, i) {
    const d = cornerPath(p, i);
    if (d !== undefined) return flatten(parsePath(d));
  },
  draw: {
    tree(m, t) {
      m.nodes.forEach((n, i) => {
        if (n.type === 'rect' && n.raw.corners) t.nodes[i]!.kind = 'path';
      });
    },
    frame(p, i, data) {
      if (p.model.doc.requires?.includes('paint')) return;
      const d = cornerPath(p, i);
      if (d !== undefined) data.geometry = { kind: 'path', d };
    },
  },
};
