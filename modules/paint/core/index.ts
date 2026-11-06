import { after } from '../manifest.ts';
import { geometry } from './geometry.ts';
// Independently implemented from the SVG paint model; no Rive runtime algorithm is used.
import type { Module } from '../../../packages/core/src/modules.ts';
import { parseHex } from '../../../packages/core/src/color.ts';
import { drawColor, geometryLength } from '../../../packages/core/src/draw.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';
import type { ObjShape, Prop, Shape } from '../../../packages/core/src/registry.ts';

const number = (min?: number, max?: number): Shape => ({ k: 'num', min, max });
const coords = ['x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'fx', 'fy'];
const stop: ObjShape = {
  k: 'obj',
  p: { position: { ...number(0, 1), markup: 'offset' }, color: { k: 'str', markup: 'stop-color' } },
  req: ['position', 'color'],
};
const shapes: Record<string, Shape> = {
  type: { k: 'str', of: ['linear', 'radial'] },
  ...Object.fromEntries(coords.map((k) => [k, number(k === 'r' ? 0 : undefined)])),
  stops: { k: 'arr', of: { ...stop, element: 'stop' }, min: 2 },
};
for (const s of Object.values(shapes)) s.element = 'gradient';
const gradientForm = (type: string, fields: string[]) => ({
  shape: {
    k: 'obj' as const,
    p: Object.fromEntries([...fields, 'stops'].map((k) => [k, shapes[k]!])),
    req: [...fields, 'stops'],
  },
  values: { type },
  target: { attribute: 'paint', default: 'fill', choices: ['fill', 'stroke'] },
});
const props: Record<string, Prop> = Object.fromEntries(
  coords.map((k) => [k, { type: 'number', ...(k === 'r' ? { min: 0 } : {}) }]),
);
const stopProps: Record<string, Prop> = {
  position: { type: 'number', min: 0, max: 1, feature: 'paint' },
  color: { type: 'color', feature: 'paint' },
};

const base: Module = {
  name: 'paint',
  after,
  entries: [
    {
      target: 'fill',
      shapes,
      props,
      required: [],
      elements: {
        linearGradient: gradientForm('linear', ['x1', 'y1', 'x2', 'y2']),
        radialGradient: {
          ...gradientForm('radial', ['cx', 'cy', 'r', 'fx', 'fy']),
          shape: {
            k: 'obj',
            p: Object.fromEntries(
              ['cx', 'cy', 'r', 'fx', 'fy', 'stops'].map((k) => [k, shapes[k]!]),
            ),
            req: ['cx', 'cy', 'r', 'stops'],
          },
        },
        stop: { shape: stop },
      },
    },
    {
      target: 'stroke',
      shapes: {
        ...shapes,
        dash: {
          k: 'arr',
          min: 1,
          of: { k: 'alt', of: [number(0), { k: 'str', re: /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?%$/ }] },
          markup: 'stroke-dasharray',
        },
        dashOffset: { ...number(), markup: 'stroke-dashoffset' },
      },
      props: { ...props, dashOffset: { type: 'number', def: 0, markup: 'stroke-dashoffset' } },
      required: [],
    },
  ],
  load(model, _raw, d) {
    const pointers: string[] = [];
    const counts = new Map<number, number>();
    model.nodes.forEach((n, i) => {
      const index = counts.get(n.parent) ?? 0;
      counts.set(n.parent, index + 1);
      pointers[i] = (n.parent < 0 ? '/nodes' : pointers[n.parent] + '/children') + '/' + index;
      for (const key of ['fill', 'stroke']) {
        const p = n.raw[key];
        if (!p) continue;
        const base = pointers[i] + '/' + key;
        const bad = (field: string, message: string, hint?: string) =>
          d.err('bad-value', base + (field ? '/' + field : ''), V && message, V && hint);
        if (p.type === 'image' && !model.doc.requires?.includes('surface'))
          d.err(
            'undeclared-feature',
            base + '/type',
            V && 'image paints need surface',
            V && 'add surface to requires',
          );
        if (p.type === undefined) {
          if (p.color === undefined)
            d.err(
              'missing-key',
              base,
              V && 'paint needs a color or gradient type',
              V && 'add color or type with gradient coordinates and stops',
            );
          for (const k of [...coords, 'stops'])
            if (k in p)
              bad(k, 'gradient fields need a gradient type', 'add type: linear or radial');
        } else if (p.type !== 'image') {
          if (p.color !== undefined)
            bad('color', 'a gradient cannot also have a flat color', 'remove color');
          const fields = p.type === 'linear' ? ['x1', 'y1', 'x2', 'y2'] : ['cx', 'cy', 'r'];
          for (const k of [...fields, 'stops'])
            if (!(k in p)) d.err('missing-key', base, V && `gradient needs ${k}`, V && `add ${k}`);
          for (const k of coords)
            if (k in p && !fields.includes(k) && !(p.type === 'radial' && ['fx', 'fy'].includes(k)))
              bad(k, `not a ${p.type} gradient coordinate`);
          p.stops?.forEach((s: { position: number; color: string }, j: number) => {
            if (j && s.position < p.stops[j - 1].position)
              bad(
                `stops/${j}/position`,
                'stop positions must be nondecreasing',
                'order stops by position',
              );
            if (
              !parseHex(s.color) &&
              s.color !== 'currentColor' &&
              !Object.hasOwn(model.colors, s.color)
            ) {
              const slot = /^[a-z][a-zA-Z0-9-]*$/.test(s.color);
              d.err(
                slot ? 'unknown-color-slot' : 'bad-color',
                `${base}/stops/${j}/color`,
                V && `unknown stop colour "${s.color}"`,
                V &&
                  (slot
                    ? 'declare it in "colors"'
                    : 'use a hex colour, currentColor or a declared slot'),
              );
            }
          });
        }
        if (p.dash) {
          if (p.dash.some((x: unknown) => typeof x !== typeof p.dash[0]))
            bad(
              'dash',
              'dash lengths must use one unit',
              'use all grid lengths or all percentages',
            );
          if (p.dash.every((x: string | number) => parseFloat(String(x)) === 0))
            bad('dash', 'dash pattern cannot be all zero', 'include a positive length');
        }
      }
    });
  },
  model(n, key) {
    const focal = /^(fill|stroke)\.(fx|fy)$/.exec(key);
    if (focal && n.raw[focal[1]!]?.type === 'radial') {
      const raw = n.raw[focal[1]!];
      return {
        prop: { type: 'number', feature: 'paint' },
        rest: raw[focal[2]!] ?? raw[focal[2] === 'fx' ? 'cx' : 'cy'],
      };
    }
    const m = /^(fill|stroke)\.stops\.(0|[1-9][0-9]*)\.(position|color)$/.exec(key);
    if (!m) return;
    const s = n.raw[m[1]!]?.stops?.[+m[2]!];
    if (!s) return;
    const value = s[m[3]!];
    return { prop: stopProps[m[3]!]!, rest: m[3] === 'color' ? (parseHex(value) ?? value) : value };
  },
  draw: {
    tree(model, tree) {
      model.nodes.forEach((n, node) => {
        for (const key of ['fill', 'stroke'])
          if (n.raw[key]?.type && n.raw[key].type !== 'image')
            tree.resources.push({
              node,
              kind: 'gradient',
              key,
              paint: {
                kind: key as 'fill' | 'stroke',
                type: n.raw[key].type,
                visible: true,
                stops: n.raw[key].stops,
              },
            });
      });
    },
    frame(p, i, data) {
      for (const paint of data.paints)
        enhancePaint(p, i, paint, paint.key ?? paint.kind, data.geometry);
    },
  },
};

export function enhancePaint(
  p: import('../../../packages/core/src/player.ts').Player,
  i: number,
  paint: import('../../../packages/core/src/draw.ts').DrawPaint,
  key: string,
  geometry: import('../../../packages/core/src/draw.ts').Geometry | undefined,
): void {
  const raw = key.split('.').reduce((o, k) => o?.[k], p.model.nodes[i]!.raw);
  if (!raw) return;
  if (raw.type && raw.type !== 'image') {
    paint.color = undefined;
    paint.type = raw.type;
    paint.coordinates = {};
    for (const k of raw.type === 'linear'
      ? ['x1', 'y1', 'x2', 'y2']
      : ['cx', 'cy', 'r', 'fx', 'fy'])
      paint.coordinates[k] = p.num(
        i,
        `${key}.${k}`,
        k === 'fx' ? p.num(i, `${key}.cx`, 0) : k === 'fy' ? p.num(i, `${key}.cy`, 0) : 0,
      );
    let position = 0;
    paint.stops = raw.stops.map((_s: unknown, j: number) => ({
      position: Math.min(
        1,
        (position = Math.max(position, p.num(i, `${key}.stops.${j}.position`, 0))),
      ),
      color: drawColor(p, p.prop(i, `${key}.stops.${j}.color`)),
    }));
  }
  if (raw.scale === 'fixed') paint.scale = 'fixed';
  if (raw.dash) {
    const relative = typeof raw.dash[0] === 'string';
    const array = raw.dash.map((x: string | number) =>
      relative ? parseFloat(String(x)) / 100 : +x,
    );
    const offset = p.num(i, key + '.dashOffset', 0);
    const length = relative ? geometryLength(geometry, p.model.draw!.nodes[i]) : 1;
    paint.dash = array.map((v: number) => v * length);
    paint.dashOffset = offset * length;
    if (relative) {
      paint.dashNormalized = array;
      paint.dashOffsetNormalized = offset;
    }
  }
}
export const paint: Module = {
  ...base,
  entries: [...base.entries, ...geometry.entries],
  outline: geometry.outline,
  value: geometry.value,
  interpolate: geometry.interpolate,
  model: (n, k) => geometry.model?.(n, k) ?? base.model?.(n, k),
  draw: {
    tree(m, t) {
      base.draw?.tree?.(m, t);
      geometry.draw?.tree?.(m, t);
    },
    frame(p, i, d, e, f) {
      geometry.draw?.frame?.(p, i, d, e, f);
      base.draw?.frame?.(p, i, d, e, f);
    },
  },
};
