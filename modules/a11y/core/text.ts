import type { Module } from '../../../packages/core/src/modules.ts';
import type { TextModule } from '../../text/core/index.ts';
import type { runtime as Runtime } from './runtime.ts';
import { apply } from '../../../packages/core/src/geom.ts';
/** Optional consumer of the active text module; neither text nor its measurer is bundled here. */
export function installTextSemantics(
  runtime: typeof Runtime,
  modules: ReadonlyMap<string, Module>,
) {
  runtime.enrich = (entries, track) => {
    const text = modules.get('text') as TextModule | undefined;
    if (!text) return;
    const content = new Map<string, string>();
    for (const e of entries) {
      if (String(e.p.model.nodes[e.i]!.type) !== 'text') continue;
      const layout = track(() => text.textLayout(e.p, e.i));
      content.set(
        e.id,
        track(() =>
          text
            .input(e.p, e.i)
            .runs.map((r) => r.text)
            .join(''),
        ),
      );
      if (e.config?.bounds) continue;
      const points = layout.lines.flatMap((l): [number, number][] => {
        const xs = l.clusters.flatMap((c) => [c.x, c.x + c.advance]);
        const x = xs.length ? Math.min(...xs) : 0;
        const y = l.baseline - l.ascent * layout.scale;
        let left = x,
          top = y,
          right = xs.length ? Math.max(...xs) : x,
          bottom = l.baseline + l.descent * layout.scale;
        if (layout.clip) {
          const [cx, cy, w, h] = layout.clip;
          if (right < cx || left > cx + w || bottom < cy || top > cy + h) return [];
          left = Math.max(left, cx);
          top = Math.max(top, cy);
          right = Math.max(left, Math.min(right, cx + w));
          bottom = Math.max(top, Math.min(bottom, cy + h));
        }
        return [
          [left, top],
          [right, top],
          [left, bottom],
          [right, bottom],
        ].map(([x, y]) => apply(e.matrix, x!, y!));
      });
      if (points.length) {
        const xs = points.map((p) => p[0]),
          ys = points.map((p) => p[1]);
        const x = Math.min(...xs),
          y = Math.min(...ys);
        e.bounds = [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
      } else e.bounds = [...apply(e.matrix, 0, 0), 0, 0];
    }
    const owners = new Map(entries.map((e) => [e.id, e]));
    // Inherit visibility before bottom-up text aggregation, including nonsemantic parents.
    for (const e of entries) e.visible &&= owners.get(e.parent)?.visible ?? true;
    for (const e of [...entries].reverse()) {
      if (!e.visible) continue;
      const value = content.get(e.id) ?? '';
      if (e.data.label === undefined && value) e.data.label = value;
      content.set(e.parent, value + (content.get(e.parent) ?? ''));
    }
  };
}
