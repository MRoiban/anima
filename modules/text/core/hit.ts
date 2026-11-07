import type { TextLayout } from './layout.ts';
import type { TextModule } from './index.ts';
import type { Player } from '../../../packages/core/src/player.ts';
export type TextBox = [number, number, number, number];
/** Grapheme ordinals (not UTF-16 offsets). Geometry is in text-local grid units. */
export function textStops(layout: TextLayout, source: string) {
  const segments = [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(source)];
  let offset = 0;
  return layout.lines.flatMap((line) => {
    const top = line.baseline - line.ascent * layout.scale;
    const height = (line.ascent + line.descent) * layout.scale;
    const clusters = line.clusters;
    const stops = clusters.map((c) => ({ offset: c.index, x: c.x }));
    const last = clusters.at(-1);
    const end = last ? last.index + last.text.length : offset;
    stops.push({ offset: end, x: last ? last.x + last.advance : 0 });
    offset = end + (source.slice(end).match(/^(\r\n|\r|\n)/)?.[0].length ?? 0);
    return stops.map((s) => ({
      index: segments.filter((g) => g.index < s.offset).length,
      box: [s.x, top, 0, height] as TextBox,
    }));
  });
}
export function textHit(layout: TextLayout, source: string, x: number, y: number): number {
  let bestY = Infinity,
    bestX = Infinity,
    index = 0;
  for (const s of textStops(layout, source)) {
    const [sx, sy, , h] = s.box;
    const dy = Math.max(sy - y, 0, y - sy - h);
    // Choose the nearest line first, then its nearest caret. Ties use logical order.
    const dx = Math.abs(sx - x);
    if (dy < bestY || (dy === bestY && dx < bestX)) {
      bestY = dy;
      bestX = dx;
      index = s.index;
    }
  }
  return index;
}
export function textSelection(
  layout: TextLayout,
  source: string,
  start: number,
  end = start,
): TextBox[] {
  const stops = textStops(layout, source);
  const max = [...new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(source)].length;
  const clamp = (n: number) => Math.max(0, Math.min(max, Math.trunc(n) || 0));
  [start, end] = [clamp(Math.min(start, end)), clamp(Math.max(start, end))];
  if (start === end) return [stops.reverse().find((s) => s.index <= start)?.box ?? [0, 0, 0, 0]];
  const boxes: TextBox[] = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    const a = stops[i]!,
      b = stops[i + 1]!;
    if (a.index < start || a.index >= end || a.box[1] !== b.box[1]) continue;
    const x = Math.min(a.box[0], b.box[0]),
      right = Math.max(a.box[0], b.box[0]);
    const previous = boxes.at(-1);
    if (previous && previous[1] === a.box[1]) {
      const end = Math.max(right, previous[0] + previous[2]);
      previous[0] = Math.min(x, previous[0]);
      previous[2] = end - previous[0];
    } else boxes.push([x, a.box[1], right - x, a.box[3]]);
  }
  return boxes;
}
export function textSource(text: TextModule, p: Player, i: number): string {
  return text
    .input(p, i)
    .runs.map((r) => r.text)
    .join('');
}

/** Install the optional listener reader on the active module, without a second text registration. */
export function installTextHit(text: TextModule) {
  text.outline = (p, i) => {
    if (String(p.model.nodes[i]!.type) !== 'text') return;
    const layout = text.textLayout(p, i);
    return layout.lines.map((l) => {
      const xs = l.clusters.flatMap((c) => [c.x, c.x + c.advance]);
      const x = xs.length ? Math.min(...xs) : 0,
        y = l.baseline - l.ascent * layout.scale,
        w = xs.length ? Math.max(...xs) - x : 0,
        h = (l.ascent + l.descent) * layout.scale;
      return { pts: [x, y, x + w, y, x + w, y + h, x, y + h], closed: true };
    });
  };
  text.fillContains = (p, i, outline, x, y) => {
    if (String(p.model.nodes[i]!.type) !== 'text') return;
    const c = text.textLayout(p, i).clip;
    return (
      (!c || (x >= c[0] && y >= c[1] && x <= c[0] + c[2] && y <= c[1] + c[3])) &&
      outline.some(({ pts }) => x >= pts[0]! && x <= pts[2]! && y >= pts[1]! && y <= pts[5]!)
    );
  };
  text.hitTest = (p, i, x, y) => textHit(text.textLayout(p, i), textSource(text, p, i), x, y);
}
