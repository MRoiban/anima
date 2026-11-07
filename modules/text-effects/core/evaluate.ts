import type { DrawColor } from '../../../packages/core/src/draw.ts';
import { parseEase } from '../../../packages/core/src/ease.ts';
import { flatten, parsePath } from '../../../packages/core/src/path.ts';
import { mul, IDENTITY, type Mat } from '../../../packages/core/src/geom.ts';
import { words } from '../../text/core/measure.ts';
import type { TextDrawing } from '../../text/core/index.ts';
import type { Cluster } from '../../text/core/layout.ts';
export interface Range {
  start?: number;
  end?: number;
  units?: 'glyphs' | 'words' | 'lines';
  falloff?: number;
  ease?: string;
  combine?: string;
  run?: string;
}
export interface Effect extends Range {
  x?: number;
  y?: number;
  rotate?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  originX?: number;
  originY?: number;
  amount?: number;
  axes?: Record<string, number>;
  followPath?: string;
  pathOffset?: number;
  ranges?: Range[];
}
export interface EffectCluster extends Cluster {
  matrix: Mat;
  alpha: number;
}
export type BackgroundStyle = string | { color: string; radius?: number };
export interface Background {
  x: number;
  y: number;
  width: number;
  height: number;
  color: DrawColor;
  radius?: number;
}
export interface EffectDrawing extends TextDrawing {
  effected?: boolean;
  direction?: 'auto' | 'ltr' | 'rtl';
  backgrounds?: Background[];
}
/** Internal polyline arc-length sampler. Cubics use core's fixed 12-subdivision flattening. */
export function pathSampler(path: string) {
  const segments: number[][] = [];
  let length = 0;
  for (const { pts, closed } of flatten(parsePath(path))) {
    const points = closed ? [...pts, pts[0]!, pts[1]!] : pts;
    for (let i = 2; i < points.length; i += 2) {
      const x = points[i - 2]!,
        y = points[i - 1]!,
        dx = points[i]! - x,
        dy = points[i + 1]! - y;
      const size = Math.hypot(dx, dy);
      if (size) {
        segments.push([length, size, x, y, dx, dy]);
        length += size;
      }
    }
  }
  return (distance: number): [number, number, number] => {
    const at = Math.max(0, Math.min(length, distance));
    const s = segments.find((s) => at <= s[0]! + s[1]!) ?? segments.at(-1);
    if (!s) return [0, 0, 0];
    const t = (at - s[0]!) / s[1]!;
    return [s[2]! + s[4]! * t, s[3]! + s[5]! * t, Math.atan2(s[5]!, s[4]!)];
  };
}
export function applyEffects(
  data: TextDrawing,
  effects: Effect[],
  background: Record<string, BackgroundStyle> = {},
): EffectDrawing {
  const all = data.layout.lines.flatMap((l) => l.clusters);
  const effectsByRange = new Map<Range, Map<Cluster, number>>();
  const weights = (r: Range) => {
    let result = effectsByRange.get(r);
    if (result) return result;
    result = new Map();
    effectsByRange.set(r, result);
    const scoped = all.filter((c) => r.run === undefined || data.runs[c.run]?.id === r.run);
    let sourceOffset = 0,
      scopedOffset = 0;
    const offsets = data.runs.map((run) => {
      const selected = r.run === undefined || run.id === r.run;
      const offset = scopedOffset - sourceOffset;
      sourceOffset += run.text.length;
      if (selected) scopedOffset += run.text.length;
      return offset;
    });
    const string = data.runs
      .filter((run) => r.run === undefined || run.id === r.run)
      .map((r) => r.text)
      .join('');
    const segments = [...words.segment(string)];
    const ease = parseEase(r.ease ?? 'linear');
    const lineIds = new Map<number, number>();
    scoped.forEach((c, i) => {
      const li = data.layout.lines.findIndex((l) => l.clusters.includes(c));
      if (!lineIds.has(li)) lineIds.set(li, lineIds.size);
      const offset = c.index + offsets[c.run]!;
      const word = segments.findIndex(
        (w) => offset >= w.index && offset < w.index + w.segment.length,
      );
      // Word units count Intl word-like segments; punctuation/whitespace is unselected.
      const wi =
        word < 0 || !segments[word]!.isWordLike
          ? -1
          : segments.slice(0, word).filter((w) => w.isWordLike).length;
      const unit = r.units === 'lines' ? lineIds.get(li)! : r.units === 'words' ? wi : i;
      let w = unit < 0 ? 0 : unit >= (r.start ?? 0) && unit < (r.end ?? Infinity) ? 1 : 0;
      if (unit >= 0 && r.falloff) {
        const distance = Math.max((r.start ?? 0) - unit, unit - (r.end ?? Infinity) + 1, 0);
        w = Math.max(0, 1 - distance / r.falloff);
      }
      result!.set(c, typeof ease === 'function' ? Math.max(0, Math.min(1, ease(w))) : w);
    });
    return result;
  };
  const paths = effects.map((e) => (e.followPath ? pathSampler(e.followPath) : undefined));
  const layout = {
    ...data.layout,
    lines: data.layout.lines.map((line) => ({
      ...line,
      clusters: line.clusters.map((c) => {
        const out: EffectCluster = {
          ...c,
          matrix: IDENTITY,
          alpha: 1,
          font: { ...c.font, axes: { ...c.font.axes } },
        };
        effects.forEach((e, ei) => {
          let w = 0;
          for (const [ri, r] of [e, ...(e.ranges ?? [])].entries()) {
            const v = weights(r).get(c) ?? 0;
            w =
              ri === 0
                ? v
                : r.combine === 'intersect'
                  ? w * v
                  : r.combine === 'subtract'
                    ? w * (1 - v)
                    : r.combine === 'replace'
                      ? v
                      : r.combine === 'max'
                        ? Math.max(w, v)
                        : Math.min(1, w + v);
          }
          w *= e.amount ?? 1;
          if (!w) return;
          let x = (e.x ?? 0) * w,
            y = (e.y ?? 0) * w,
            angle = (((e.rotate ?? 0) * Math.PI) / 180) * w;
          if (paths[ei]) {
            const [px, py, tangent] = paths[ei]!(c.x + (e.pathOffset ?? 0));
            x += (px - c.x) * w;
            y += (py - c.y) * w;
            angle += tangent * w;
          }
          const sx = 1 + ((e.scaleX ?? 1) - 1) * w,
            sy = 1 + ((e.scaleY ?? 1) - 1) * w;
          const a = Math.cos(angle) * sx,
            b = Math.sin(angle) * sx,
            cc = -Math.sin(angle) * sy,
            d = Math.cos(angle) * sy;
          const ox = c.x + (e.originX ?? 0),
            oy = c.y + (e.originY ?? 0);
          out.matrix = mul(out.matrix, [
            a,
            b,
            cc,
            d,
            x + ox - a * ox - cc * oy,
            y + oy - b * ox - d * oy,
          ]);
          out.alpha *= 1 + ((e.opacity ?? 1) - 1) * w;
          for (const [axis, target] of Object.entries(e.axes ?? {})) {
            const rest = out.font.axes![axis] ?? (axis === 'wght' ? c.font.weight : 0);
            out.font.axes![axis] = rest + (target - rest) * w;
          }
        });
        return out;
      }),
    })),
  };
  const backgrounds: Background[] = [];
  for (const line of data.layout.lines) {
    for (let i = 0; i < line.clusters.length;) {
      const c = line.clusters[i]!,
        start = i;
      while (i < line.clusters.length && line.clusters[i]!.run === c.run) i++;
      const style = background[data.runs[c.run]?.id ?? String(c.run)];
      const color = typeof style === 'string' ? style : style?.color;
      if (color) {
        let x = c.x,
          end = c.x;
        for (let j = start; j < i; j++) {
          const g = line.clusters[j]!;
          x = Math.min(x, g.x, g.x + g.advance);
          end = Math.max(end, g.x, g.x + g.advance);
        }
        backgrounds.push({
          x,
          y: c.y - line.ascent,
          width: end - x,
          height: line.ascent + line.descent,
          color,
          radius: typeof style === 'object' ? style.radius : undefined,
        });
      }
    }
  }
  return { ...data, layout, effected: effects.length > 0, backgrounds };
}
