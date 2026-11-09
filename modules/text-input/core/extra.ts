import type { Player } from '../../../packages/core/src/player.ts';
import type { Field, FieldConfig, FieldNode } from './index.ts';
// Pure viewport projection: the measured layout and the field's outer box never change.
const offsets = new WeakMap<Field, [number, number]>();
export function enhanceField(p: Player, i: number, node: FieldNode, c: FieldConfig, f: Field) {
  const drawing = node.text;
  if (!drawing) return;
  const layout = drawing.layout,
    boxes = node.fieldBoxes!;
  const width = p.prop(i, 'width') as number,
    height = p.prop(i, 'height') as number;
  const origin = p.model.nodes[i]!.raw.origin;
  const x = Array.isArray(origin) ? -origin[0] * width : 0;
  const y = Array.isArray(origin)
    ? -origin[1] * height
    : origin === 'baseline'
      ? -(layout.lines[0]?.baseline ?? 0)
      : 0;
  const cw = f.start === f.end ? 0.06 : 0;
  let [dx, dy] = offsets.get(f) ?? [0, 0];
  // Locate the active selection end even while selected (no caret box is then drawn).
  const gs = layout.lines.flatMap((l) => l.clusters);
  const next = gs.find((g) => g.index >= f.end),
    last = gs.at(-1);
  const line = layout.lines.find((l) =>
    next ? l.clusters.includes(next) : l === layout.lines.at(-1),
  );
  const cx = next?.x ?? (last ? last.x + last.advance : (line?.x ?? x));
  const cy = line ? line.baseline - line.ascent * layout.scale : y;
  const ch = line ? (line.ascent + line.descent) * layout.scale : 0;
  if (p.focused === p.model.nodes[i]!.id) {
    const caret = f.start === f.end ? boxes.at(-1) : undefined;
    const left = caret?.x ?? cx,
      top = caret?.y ?? cy,
      h = caret?.height ?? ch;
    if (c.multiline) {
      dy = Math.max(top + h - height - y, Math.min(dy, top - y));
      dx = 0;
    } else {
      dx = Math.max(left + cw - width - x, Math.min(dx, left - x));
      dy = 0;
    }
  }
  // Clamp after deletion, replacement, resize or reveal changes the content extent.
  dx = Math.max(
    0,
    Math.min(dx, Math.max(0, Math.max(layout.contentWidth + x, cx) + cw - x - width)),
  );
  dy = Math.max(0, Math.min(dy, Math.max(0, layout.contentHeight - height)));
  offsets.set(f, [dx, dy]);
  drawing.layout = {
    ...layout,
    clip: [x, y, width, height],
    lines: layout.lines.map((l) => ({
      ...l,
      baseline: l.baseline - dy,
      x: (l.x ?? 0) - dx,
      clusters: l.clusters.map((g) => ({ ...g, x: g.x - dx, y: g.y - dy })),
    })),
  };
  node.fieldBoxes = boxes.flatMap((b) => {
    if (f.caretHidden && f.start === f.end) return [];
    if (c.multiline && f.start === f.end)
      b = { ...b, x: Math.max(x, Math.min(b.x, x + width - b.width)) };
    const left = Math.max(x, b.x - dx),
      top = Math.max(y, b.y - dy);
    const right = Math.min(x + width, b.x - dx + b.width),
      bottom = Math.min(y + height, b.y - dy + b.height);
    return right > left && bottom > top
      ? [
          {
            ...b,
            x: left,
            y: top,
            width: b.x - dx >= x && b.x - dx + b.width <= x + width ? b.width : right - left,
            height: b.y - dy >= y && b.y - dy + b.height <= y + height ? b.height : bottom - top,
          },
        ]
      : [];
  });
}
