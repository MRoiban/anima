import type { Module } from '../../../packages/core/src/modules.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { nodePointer } from '../../components/core/node-pointer.ts';
import { parseEase } from '../../../packages/core/src/ease.ts';
import { drawColor } from '../../../packages/core/src/draw.ts';
import { parseHex } from '../../../packages/core/src/color.ts';
import { parsePath } from '../../../packages/core/src/path.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import type { TextDrawNode } from '../../text/core/index.ts';
import { after } from '../manifest.ts';
import { entries, effectShape, rangeShape } from './registry.ts';
import { applyEffects, type Effect, type Range } from './evaluate.ts';
export { applyEffects } from './evaluate.ts';
export type { EffectDrawing, EffectCluster } from './evaluate.ts';
export const textEffects: Module = {
  name: 'texteffects',
  after,
  entries,
  init(registry) {
    return { ...textEffects, entries: registry.has('text') ? entries : [] };
  },
  model(node, key) {
    const axis = /^effects\.(\d+)\.axes\.([\x20-\x7e]{4})$/.exec(key);
    if (
      String(node.type) === 'text' &&
      axis &&
      node.raw.effects?.[+axis[1]!]?.axes?.[axis[2]!] !== undefined
    )
      return {
        prop: { type: 'number', feature: 'texteffects' },
        rest: node.raw.effects[+axis[1]!].axes[axis[2]!],
      };
    const m = /^effects\.(\d+)\.(?:(ranges)\.(\w+)\.)?(\w+)$/.exec(key);
    if (String(node.type) !== 'text' || !m) return;
    let e = node.raw.effects?.[+m[1]!];
    const field = m[4]!;
    if (m[2] === 'ranges') e = e?.ranges?.[Number(m[3])];
    const shape = (m[2] ? rangeShape : effectShape).p[field];
    if (!e || shape?.k !== 'num') return;
    return {
      prop: { type: 'number', min: shape.min, max: shape.max, feature: 'texteffects' },
      rest: e[field] ?? (['scaleX', 'scaleY', 'opacity', 'amount'].includes(field) ? 1 : 0),
    };
  },
  resolve(model, d) {
    for (const [i, node] of model.nodes.entries()) {
      if (String(node.type) !== 'text') continue;
      const at = nodePointer(model, i);
      const fail = (p: string, code: string, message: string, hint: string) =>
        d.err(code, at + p, V && message, V && hint);
      const run = (id: string) =>
        Array.isArray(node.raw.runs) && node.raw.runs.some((r: { id?: string }) => r.id === id);
      const range = (r: Range, p: string) => {
        if ((r.end ?? Infinity) < (r.start ?? 0))
          fail(p + '/end', 'text-range', 'range end precedes start', 'use start ≤ end');
        if (r.run !== undefined && typeof node.raw.runs !== 'string' && !run(r.run))
          fail(p + '/run', 'text-effect-run', 'unknown run id', 'name an authored run id');
        if (r.ease && typeof parseEase(r.ease) !== 'function')
          fail(
            p + '/ease',
            'bad-ease',
            'invalid range easing',
            'use a core easing such as linear or cubic(0.2,0,0.8,1)',
          );
      };
      for (const [id, style] of Object.entries(node.raw.background ?? {})) {
        const color = typeof style === 'string' ? style : (style as { color: string }).color;
        if (
          typeof node.raw.runs !== 'string' &&
          !run(id) &&
          !(String(+id) === id && node.raw.runs[+id])
        )
          fail(
            ptr('/background', id),
            'text-effect-run',
            'unknown background run',
            'name a run id or its decimal index',
          );
        if (color !== 'currentColor' && !model.colors[color] && !parseHex(color))
          fail(
            ptr('/background', id),
            'text-background-color',
            'invalid background color',
            'use a hex color, currentColor or declared color slot',
          );
      }
      (node.raw.effects ?? []).forEach((e: Effect, ei: number) => {
        const p = '/effects/' + ei;
        range(e, p);
        e.ranges?.forEach((r, ri) => range(r, p + '/ranges/' + ri));
        if (e.followPath)
          try {
            if (parsePath(e.followPath).some((p) => !p.segs.every(Number.isFinite))) throw Error();
          } catch {
            fail(p + '/followPath', 'text-effect-path', 'invalid follow path', 'use SVG path data');
          }
      });
    }
  },
  draw: {
    frame(p, i, node) {
      const data = (node as TextDrawNode).text;
      if (!data) return;
      const raw = p.model.nodes[i]!.raw;
      if (!raw.effects && !raw.background && !raw.direction) return;
      const read = (e: object, prefix: string): object =>
        Object.fromEntries(
          [
            ...new Set([
              ...Object.keys(e),
              ...Object.keys(effectShape.p).filter((k) => effectShape.p[k]?.k === 'num'),
            ]),
          ].map((k) => {
            const v = (e as Record<string, unknown>)[k];
            return [
              k,
              Array.isArray(v)
                ? v.map((r, ri) => read(r, `${prefix}.${k}.${ri}`))
                : k === 'axes' && v
                  ? Object.fromEntries(
                      Object.entries(v).map(([axis, rest]) => [
                        axis,
                        p.prop(i, `${prefix}.axes.${axis}`) ?? rest,
                      ]),
                    )
                  : (p.prop(i, `${prefix}.${k}`) ?? v),
            ];
          }),
        );
      const effects = (raw.effects ?? []).map((e: Effect, ei: number) =>
        read(e, `effects.${ei}`),
      ) as Effect[];
      const drawing = applyEffects(data, effects, raw.background);
      drawing.direction = raw.direction;
      for (const b of drawing.backgrounds ?? []) b.color = drawColor(p, b.color);
      (node as TextDrawNode).text = drawing;
    },
  },
};
