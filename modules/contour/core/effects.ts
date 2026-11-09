import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
// Effect stacks operate on local geometry, independently of either renderer.
import type { Module } from '../../../packages/core/src/modules.ts';
import type { Shape } from '../../../packages/core/src/registry.ts';
import type { Geometry } from '../../../packages/core/src/draw.ts';
import { fmt } from '../../../packages/core/src/draw.ts';
import { parsePath, M, C, Z } from '../../../packages/core/src/path.ts';
type Point = [number, number];
type Line = Point[];
export interface Effect {
  type: 'trim' | 'dash';
  start?: number;
  end?: number;
  offset?: number;
  mode?: string;
  dash?: number[];
}
const num: Shape = { k: 'num' };
export const trimShape: Shape = {
  k: 'obj',
  p: {
    start: { k: 'num', min: 0, max: 1 },
    end: { k: 'num', min: 0, max: 1 },
    offset: num,
    mode: { k: 'str', of: ['sequential', 'synchronized'] },
  },
  req: [],
};
const effectShape: Shape = {
  k: 'obj',
  p: {
    ...(trimShape as Extract<Shape, { k: 'obj' }>).p,
    type: { k: 'str', of: ['trim', 'dash'] },
    dash: { k: 'arr', min: 1, of: { k: 'num', min: 0 } },
  },
  req: ['type'],
};
const stack: Shape = { k: 'arr', of: effectShape };
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
export function polylines(d: string): Line[] {
  return parsePath(d).map((sp) => {
    const out: Line = [];
    let at: Point = [0, 0];
    const cubic = (a: Point, b: Point, c: Point, e: Point, depth = 0) => {
      // A bounded, local-grid error independent of backend tessellation.
      if (depth === 20 || dist(a, b) + dist(b, c) + dist(c, e) - dist(a, e) <= 0.0001) {
        out.push(e);
        return;
      }
      const ab = lerp(a, b, 0.5),
        bc = lerp(b, c, 0.5),
        ce = lerp(c, e, 0.5),
        abc = lerp(ab, bc, 0.5),
        bce = lerp(bc, ce, 0.5),
        m = lerp(abc, bce, 0.5);
      cubic(a, ab, abc, m, depth + 1);
      cubic(m, bce, ce, e, depth + 1);
    };
    for (let i = 0; i < sp.segs.length;) {
      const op = sp.segs[i++]!;
      if (op === Z) {
        if (out.length) out.push(out[0]!);
        continue;
      }
      const p = sp.segs.slice(i, i + 2) as Point;
      i += 2;
      if (op === C) {
        const c = sp.segs.slice(i, i + 2) as Point,
          e = sp.segs.slice(i + 2, i + 4) as Point;
        i += 4;
        cubic(at, p, c, e);
        at = e;
      } else {
        out.push(p);
        at = p;
        if (op === M) at = p;
      }
    }
    return out;
  });
}
const length = (line: Line) => line.slice(1).reduce((sum, p, i) => sum + dist(line[i]!, p), 0);
function slice(line: Line, start: number, end: number): Line {
  const out: Line = [];
  let at = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!,
      b = line[i]!,
      len = dist(a, b);
    if (len && at < end && at + len > start) {
      const p = lerp(a, b, Math.max(0, (start - at) / len)),
        q = lerp(a, b, Math.min(1, (end - at) / len));
      if (!out.length) out.push(p);
      out.push(q);
    }
    at += len;
  }
  return out;
}
export function applyEffects(d: string, effects: Effect[]): string {
  let paths = polylines(d);
  for (const effect of effects) {
    if (effect.type === 'trim') {
      const fraction = Math.max(0, Math.min(1, (effect.end ?? 1) - (effect.start ?? 0)));
      if (fraction === 1) continue;
      if (!fraction) {
        paths = [];
        continue;
      }
      const start = ((((effect.start ?? 0) + (effect.offset ?? 0)) % 1) + 1) % 1;
      const ranges =
        start + fraction > 1
          ? [
              [start, 1],
              [0, start + fraction - 1],
            ]
          : [[start, start + fraction]];
      const total = paths.reduce((s, p) => s + length(p), 0);
      let base = 0;
      paths = paths.flatMap((p) => {
        const len = length(p),
          synchronized = effect.mode === 'synchronized';
        const scale = synchronized ? len : total,
          offset = synchronized ? 0 : base;
        base += len;
        return ranges
          .map(([a, b]) => slice(p, a! * scale - offset, b! * scale - offset))
          .filter((p) => p.length > 1);
      });
    } else {
      let dash = effect.dash!;
      if (dash.length % 2) dash = [...dash, ...dash];
      const period = dash.reduce((a, b) => a + b, 0);
      paths = paths.flatMap((p) => {
        const out: Line[] = [],
          len = length(p);
        let offset = (((effect.offset ?? 0) % period) + period) % period,
          index = 0;
        while (offset >= dash[index]!) {
          offset -= dash[index]!;
          index = (index + 1) % dash.length;
        }
        let at = -offset;
        while (at < len) {
          const end = at + dash[index]!;
          if (index % 2 === 0) {
            const part = slice(p, Math.max(0, at), Math.min(len, end));
            if (part.length > 1) out.push(part);
          }
          at = end;
          index = (index + 1) % dash.length;
        }
        return out;
      });
    }
  }
  return paths
    .map((p) => p.map((v, i) => (i ? 'L' : 'M') + v.map(fmt).join(' ')).join(''))
    .join('');
}
export function geometryPath(g: Geometry): string {
  if (g.d !== undefined) return g.d;
  if (g.kind === 'circle')
    return `M${g.cx! + g.r!} ${g.cy}A${g.r} ${g.r} 0 1 0 ${g.cx! - g.r!} ${g.cy}A${g.r} ${g.r} 0 1 0 ${g.cx! + g.r!} ${g.cy}Z`;
  const x = g.x!,
    y = g.y!,
    w = g.width!,
    h = g.height!,
    r = Math.min(g.rx ?? 0, w / 2, h / 2);
  return r
    ? `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`
    : `M${x} ${y}h${w}v${h}h${-w}Z`;
}
// seam(P8-9): bounds read the contour entering the first dash (later effects only remove paint).
export const effects: Module & {
  undashed(
    g: Geometry,
    raw: { effects?: (Effect | string)[] } | undefined,
    shared: unknown,
  ): Geometry | undefined;
} = {
  undashed(g, raw, shared) {
    if (!g || !raw?.effects) return;
    const stack = raw.effects.flatMap((e) =>
      typeof e === 'string' ? (shared as Record<string, Effect[]>)[e]! : [e],
    );
    const firstDash = stack.findIndex((e) => e.type === 'dash');
    if (firstDash < 0) return;
    return firstDash
      ? { kind: 'path', d: applyEffects(geometryPath(g), stack.slice(0, firstDash)) }
      : g;
  },
  name: 'contour',
  entries: [
    {
      target: 'stroke',
      shapes: {
        trim: trimShape,
        effects: {
          k: 'alt',
          of: [{ k: 'arr', of: { k: 'alt', of: [effectShape, { k: 'str' }] } }],
        },
      },
    },
    { target: 'document', shapes: { effects: { k: 'map', of: stack, markup: 'effects' } } },
  ],
  load(model, _raw, d) {
    const shared = model.doc.effects as Record<string, Effect[]> | undefined;
    const validate = (e: Effect, pointer: string) => {
      if (e.type === 'dash' && (!e.dash?.length || !e.dash.some(Boolean)))
        d.err(
          'bad-value',
          pointer + '/dash',
          V && 'dash effect needs a positive pattern length',
          V && 'include at least one positive dash length',
        );
      for (const k of e.type === 'trim' ? ['dash'] : ['start', 'end', 'mode'])
        if (k in e)
          d.err(
            'bad-value',
            pointer + '/' + k,
            V && `${k} does not belong to ${e.type} effects`,
            V && 'remove this field',
          );
    };
    for (const [id, stack] of Object.entries(shared ?? {}))
      stack.forEach((e, j) =>
        validate(e, `/effects/${id.replaceAll('~', '~0').replaceAll('/', '~1')}/${j}`),
      );
    const paths: string[] = [],
      counts = new Map<number, number>();
    model.nodes.forEach((n, i) => {
      const j = counts.get(n.parent) ?? 0;
      counts.set(n.parent, j + 1);
      const pointer = (paths[i] =
        (n.parent < 0 ? '/nodes' : paths[n.parent] + '/children') + '/' + j);
      const paints = n.raw.paints
        ? n.raw.paints.map((r: { stroke?: object }, j: number) => [
            r.stroke,
            `${pointer}/paints/${j}/stroke`,
          ])
        : [[n.raw.stroke, pointer + '/stroke']];
      for (const [raw, base] of paints) {
        if (!raw) continue;
        if (raw.effects && raw.trim)
          d.err(
            'paint-conflict',
            base + '/effects',
            V && 'use either trim or an effect stack',
            V && 'put the trim into effects',
          );
        if (
          (raw.effects || raw.trim) &&
          ['dash', 'trimStart', 'trimEnd', 'trimOffset'].some((k) => k in raw)
        )
          d.err(
            'paint-conflict',
            base,
            V && 'effect stacks cannot combine with legacy dash or trim',
            V && 'move all stroke effects into the ordered stack',
          );
        raw.effects?.forEach((e: Effect | string, j: number) => {
          if (typeof e === 'string') {
            if (!Object.hasOwn(shared ?? {}, e))
              d.err(
                'unknown-source',
                `${base}/effects/${j}`,
                V && 'unknown shared effect stack',
                V && 'declare it in document.effects',
              );
          } else validate(e, `${base}/effects/${j}`);
        });
      }
    });
  },
  draw: {
    frame(p, i, data) {
      if (!data.geometry) return;
      for (const paint of data.paints) {
        const raw = (paint.key ?? paint.kind)
          .split('.')
          .reduce((o, k) => o?.[k], p.model.nodes[i]!.raw);
        if (!raw?.effects && !raw?.trim) continue;
        const shared = p.model.doc.effects as Record<string, Effect[]> | undefined;
        const stack: Effect[] = raw.trim
          ? [{ type: 'trim', ...raw.trim }]
          : raw.effects.flatMap((e: Effect | string) => (typeof e === 'string' ? shared![e] : [e]));
        paint.geometry = { kind: 'path', d: applyEffects(geometryPath(data.geometry), stack) };
      }
    },
  },
};
