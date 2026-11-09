import type { Module } from '../../../packages/core/src/modules.ts';
import type { DrawColor } from '../../../packages/core/src/draw.ts';
import { drawColor } from '../../../packages/core/src/draw.ts';
import { parseHex, formatHex, type RGBA } from '../../../packages/core/src/color.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import { after } from '../manifest.ts';
export interface ColorMix {
  a: DrawColor;
  b: DrawColor;
  t: number;
}
declare module '../../../packages/core/src/draw.ts' {
  interface DrawPaint {
    mix?: ColorMix;
  }
}

/** CSS color-mix(in srgb) interpolates premultiplied alpha, unlike colour tracks. */
export function mixColor(a: string, b: string, t: number): string {
  const x = parseHex(a)!,
    y = parseHex(b)!;
  const alpha = x[3] * (1 - t) + y[3] * t;
  const rgb = [0, 1, 2].map((i) =>
    alpha ? Math.round((x[i]! * x[3] * (1 - t) + y[i]! * y[3] * t) / alpha) : 0,
  );
  return formatHex([...rgb, Math.round(alpha)] as RGBA);
}
const shape = {
  k: 'obj' as const,
  element: 'colorMix',
  p: { a: { k: 'str' as const }, b: { k: 'str' as const }, t: { k: 'num' as const } },
  req: ['a', 'b', 't'],
};
export const colormix: Module = {
  name: 'colormix',
  after,
  entries: ['fill', 'stroke'].map((target) => ({
    target,
    shapes: { mix: shape },
    required: [],
    ...(target === 'fill'
      ? {
          elements: {
            colorMix: {
              shape,
              target: {
                attribute: 'paint',
                default: 'fill',
                choices: ['fill', 'stroke'],
                path: ['mix'],
              },
            },
          },
        }
      : {}),
  })),
  model(n, key) {
    const m = /^(fill|stroke)\.mix\.t$/.exec(key);
    if (!m) return;
    const paint = n.raw[m[1]!];
    if (paint?.mix)
      return { prop: { type: 'number', min: 0, max: 1, feature: 'colormix' }, rest: paint.mix.t };
  },
  load(model, _raw, d) {
    const paths: string[] = [],
      counts = new Map<number, number>();
    model.nodes.forEach((n, i) => {
      const j = counts.get(n.parent) ?? 0;
      counts.set(n.parent, j + 1);
      paths[i] = (n.parent < 0 ? '/nodes' : paths[n.parent] + '/children') + '/' + j;
      const validate = (
        paint: Record<string, unknown> & { mix?: { a: string; b: string; t: number } },
        at: string,
      ) => {
        if (!paint) return;
        const mix = paint.mix;
        if (!mix) {
          // Replacing the paint required list must retain strict base semantics.
          if (paint.color === undefined && paint.type === undefined && paint.paint === undefined)
            d.err('missing-key', at, V && 'paint needs a colour source', V && 'add color or mix');
          return;
        }
        if (['color', 'type', 'paint'].some((k) => paint[k] !== undefined))
          d.err(
            'colormix-source',
            at + '/mix',
            V && 'mix cannot accompany another paint source',
            V && 'remove color, type or paint',
          );
        for (const k of ['a', 'b'] as const) {
          const c = mix[k],
            literal = parseHex(c),
            fallback = model.colors[c];
          if (!literal && (!Object.hasOwn(model.colors, c) || !parseHex(fallback!)))
            d.err(
              'colormix-color',
              at + '/mix/' + k,
              V && 'mix needs a hex colour or a slot with a hex default',
              V && 'use #rgb, #rrggbb, #rrggbbaa or declare a slot with a hex default',
            );
        }
        if (mix.t < 0 || mix.t > 1)
          d.err(
            'colormix-range',
            at + '/mix/t',
            V && 'mix weight is outside 0..1',
            V && 'use a number from 0 to 1',
          );
      };
      for (const kind of ['fill', 'stroke']) validate(n.raw[kind], paths[i] + '/' + kind);
      n.raw.paints?.forEach((p: Record<string, { mix?: unknown }>, j: number) => {
        for (const kind of ['fill', 'stroke'])
          if (p[kind]?.mix)
            d.err(
              'colormix-source',
              paths[i] + '/paints/' + j + '/' + kind + '/mix',
              V && 'mix uses the node fill or stroke',
              V && 'move mix to fill or stroke on its own node',
            );
      });
    });
  },
  draw: {
    frame(p, i, data) {
      for (const paint of data.paints) {
        const key = paint.key ?? paint.kind;
        const raw = key.split('.').reduce((o, k) => o?.[k], p.model.nodes[i]!.raw);
        if (!raw?.mix) continue;
        const { a, b } = raw.mix,
          t = p.num(i, key + '.mix.t', raw.mix.t);
        paint.mix = { a: drawColor(p, a), b: drawColor(p, b), t };
        paint.color = mixColor(p.model.colors[a] ?? a, p.model.colors[b] ?? b, t);
      }
    },
  },
};
