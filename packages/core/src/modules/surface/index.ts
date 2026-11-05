// Independent surface sampling. No Rive algorithm or source is used.
import type { Module } from '../../modules.ts';
import type { ObjShape, Shape } from '../../registry.ts';
import { parseHex } from '../../color.ts';
import { resolvedAssets } from '../assets/index.ts';
import { VERBOSE as V } from '../../flags.ts';
const num = (min?: number): Shape => ({ k: 'num', min });
const object = (p: Record<string, Shape>, req: string[] = []): ObjShape => ({ k: 'obj', p, req });
const imageFields: Record<string, Shape> = {
  asset: { k: 'str' },
  imageWidth: { k: 'num', gt: 0, markup: 'image-width' },
  imageHeight: { k: 'num', gt: 0, markup: 'image-height' },
  imageX: { ...num(), markup: 'image-x' },
  imageY: { ...num(), markup: 'image-y' },
  imageRotate: { ...num(), markup: 'image-rotate' },
  imageScaleX: { ...num(), markup: 'image-scale-x' },
  imageScaleY: { ...num(), markup: 'image-scale-y' },
  modulate: { k: 'str' },
};
const image = object(imageFields, ['asset', 'imageWidth', 'imageHeight']);
const feather = object({
  inner: num(0),
  outer: num(0),
  offset: { k: 'tup', of: [num(), num()], min: 2 },
  enabled: { k: 'bool' },
  space: { k: 'str', of: ['local', 'world'] },
});
const cuts: Shape = { k: 'arr', of: num(), min: 2 };
const slice = object(
  {
    x: cuts,
    y: cuts,
    width: { k: 'num', gt: 0 },
    height: { k: 'num', gt: 0 },
    modes: { k: 'arr', of: { k: 'str', of: ['stretch', 'repeat', 'hidden'] } },
  },
  ['x', 'y', 'width', 'height'],
);
function surfaceEntries(): Module['entries'] {
  return [
    ...['fill', 'stroke'].map((target) => ({
      target,
      shapes: {
        ...Object.fromEntries(
          Object.entries(imageFields).map(([k, v]) => [k, { ...v, element: 'imagePaint' }]),
        ),
        feather: { ...feather, markup: target + '-feather' },
      },
      elements: {
        imagePaint: {
          shape: image,
          values: { type: 'image' },
          target: { attribute: 'paint', default: 'fill', choices: ['fill', 'stroke'] },
        },
      },
    })),
    { target: 'node', shapes: { slice } },
  ];
}
let registry: ReadonlyMap<string, Module>;
export const surface: Module = {
  name: 'surface',
  init(active, shared) {
    registry = active;
    for (const paint of [shared.FILL, shared.STROKE]) {
      const type = (paint as ObjShape).p.type;
      if (type?.k === 'str' && !type.of?.includes('image')) type.of = [...(type.of ?? []), 'image'];
    }
    return { ...surface, init: undefined, entries: surfaceEntries() };
  },
  entries: [],
  load(m, raw, d) {
    if (!raw.requires?.includes('surface')) return;
    const paths: string[] = [],
      counts = new Map<number, number>();
    m.nodes.forEach((n, i) => {
      const j = counts.get(n.parent) ?? 0;
      counts.set(n.parent, j + 1);
      const path = (paths[i] = (n.parent < 0 ? '/nodes' : paths[n.parent] + '/children') + '/' + j);
      const error = (code: string, key: string, message: string, hint: string) =>
        d.err(code, path + '/' + key, V && message, V && hint);
      const paints = n.raw.paints?.map((p: Record<string, unknown>, j: number) => [
        p.fill ? 'fill' : 'stroke',
        p.fill ?? p.stroke,
        `paints/${j}/`,
      ]) ?? [
        ['fill', n.raw.fill, ''],
        ['stroke', n.raw.stroke, ''],
      ];
      for (const [kind, p, prefix] of paints) {
        if (!p) continue;
        if (p.type !== 'image') {
          for (const field of Object.keys(imageFields))
            if (field in p)
              error(
                'paint-conflict',
                prefix + kind + '/' + field,
                'image field needs type image',
                'use an image paint',
              );
          continue;
        }
        for (const field of ['asset', 'imageWidth', 'imageHeight'])
          if (p[field] === undefined)
            error('missing-key', prefix + kind, 'image paint needs ' + field, 'add ' + field);
        const key = prefix + kind,
          a = raw.assets?.[p.asset];
        if (!raw.requires?.includes('surface'))
          error('undeclared-feature', key, 'image paint needs surface', 'add surface to requires');
        if (!raw.requires?.includes('assets'))
          error('undeclared-feature', key, 'image paint needs assets', 'add assets to requires');
        if (!a)
          error(
            'unknown-asset',
            key + '/asset',
            'unknown image asset',
            'declare the image in assets',
          );
        else if (a.type !== 'image')
          error(
            'asset-type',
            key + '/asset',
            'image paint needs an image asset',
            'use an image asset',
          );
        if (
          p.color !== undefined ||
          p.stops !== undefined ||
          ['x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'fx', 'fy'].some((k) => k in p)
        )
          error(
            'paint-conflict',
            key,
            'image replaces color and gradient',
            'remove color and type',
          );
        if (p.modulate !== undefined && !parseHex(p.modulate))
          error(
            'bad-color',
            key + '/modulate',
            'modulation needs a hex color',
            'use #rrggbb or #rrggbbaa',
          );
        if (!p.imageScaleX || !p.imageScaleY) {
          if (p.imageScaleX === 0 || p.imageScaleY === 0)
            error('bad-value', key, 'image transform must be invertible', 'use nonzero scales');
        }
      }
      const s = n.raw.slice;
      if (!s) return;
      if (!['image', 'group', 'instance'].includes(String(n.type)))
        error(
          'slice-type',
          'slice',
          'slice needs an image, group or component instance',
          'wrap vector geometry in a group',
        );
      for (const axis of ['x', 'y']) {
        const c: number[] = s[axis];
        if (c.length > 9)
          error(
            'slice-limit',
            `slice/${axis}`,
            'at most 9 cuts per axis',
            'split large grids into separate nodes',
          );
        if (c.some((v, k) => k > 0 && v <= c[k - 1]!))
          error(
            'slice-cuts',
            `slice/${axis}`,
            'cuts must increase strictly',
            'include source bounds and ordered internal cuts',
          );
      }
      if (s.modes && s.modes.length !== (s.x.length - 1) * (s.y.length - 1))
        error(
          'slice-modes',
          'slice/modes',
          'one mode is needed per patch',
          'use row-major order or omit modes for stretch',
        );
      if (String(n.type) === 'image') {
        const a = raw.assets?.[n.raw.asset];
        if (
          !a?.width ||
          !a.height ||
          s.x[0] !== 0 ||
          s.y[0] !== 0 ||
          s.x.at(-1) !== a.width ||
          s.y.at(-1) !== a.height
        )
          error(
            'slice-bounds',
            'slice',
            'image slice bounds must match intrinsic dimensions',
            'declare asset dimensions; cuts start at 0 and end at width/height',
          );
      }
    });
  },
  model(n, key) {
    const match =
      /^(fill|stroke|paints\.\d+\.(?:fill|stroke))\.(feather\.(?:inner|outer|enabled|offset\.[01])|imageX|imageY|imageRotate|imageScaleX|imageScaleY)$/.exec(
        key,
      );
    if (!match) return;
    const paint = match[1]!.split('.').reduce((v, k) => v?.[k], n.raw);
    if (!paint || (match[2]!.startsWith('feather.') ? !paint.feather : paint.type !== 'image'))
      return;
    const field = match[2]!;
    const fallback = field === 'feather.enabled' ? true : field.startsWith('imageScale') ? 1 : 0;
    return {
      prop: {
        type: field === 'feather.enabled' ? 'bool' : 'number',
        feature: 'surface',
        ...(field === 'feather.inner' || field === 'feather.outer' ? { min: 0 } : {}),
      },
      rest: field.split('.').reduce((v, k) => v?.[k], paint) ?? fallback,
    };
  },
  draw: {
    tree(m, t) {
      const paths: string[] = [],
        counts = new Map<number, number>();
      m.nodes.forEach((n, i) => {
        const j = counts.get(n.parent) ?? 0;
        counts.set(n.parent, j + 1);
        paths[i] = (n.parent < 0 ? '/nodes' : paths[n.parent] + '/children') + '/' + j;
        if (n.raw.slice) t.nodes[i]!.slice = n.raw.slice;
        const paints = n.raw.paints?.map((p: Record<string, unknown>, j: number) => [
          p.fill ? 'fill' : 'stroke',
          p.fill ?? p.stroke,
          `paints.${j}.`,
        ]) ?? [
          ['fill', n.raw.fill, ''],
          ['stroke', n.raw.stroke, ''],
        ];
        for (const [kind, p, prefix] of paints)
          if (p?.type === 'image' || p?.feather)
            t.resources.push({
              node: i,
              kind: 'surface',
              key: prefix + kind,
              pointer: paths[i] + '/' + (prefix + kind).replaceAll('.', '/'),
              paint: {
                kind,
                visible: true,
                image: p.type === 'image' ? p : undefined,
                feather: p.feather,
              },
            });
      });
    },
    frame(p, i, data, entry) {
      for (const paint of data.paints) {
        const raw = (paint.key ?? paint.kind)
          .split('.')
          .reduce((v, k) => v?.[k], p.model.nodes[i]!.raw);
        if (raw?.type === 'image') {
          const r = raw,
            key = paint.key ?? paint.kind,
            num = (k: string, fallback: number) => p.num(i, key + '.' + k, fallback),
            a = ((
              registry?.get('assets') as typeof import('../assets/index.ts').assets
            )?.resolvedAssets.get(p.model) ??
              resolvedAssets.get(p.model) ??
              p.model.doc.assets)[r.asset];
          paint.color = undefined;
          paint.image = {
            source: a.source,
            width: r.imageWidth,
            height: r.imageHeight,
            x: num('imageX', 0),
            y: num('imageY', 0),
            rotate: num('imageRotate', 0),
            scaleX: num('imageScaleX', 1),
            scaleY: num('imageScaleY', 1),
            modulate: r.modulate ? parseHex(r.modulate)!.map((v) => v / 255) : undefined,
          };
        }
        if (raw?.feather) {
          const key = (paint.key ?? paint.kind) + '.feather.';
          paint.feather = {
            inner: p.num(i, key + 'inner', 0),
            outer: p.num(i, key + 'outer', 0),
            offset: [p.num(i, key + 'offset.0', 0), p.num(i, key + 'offset.1', 0)],
            enabled: p.prop(i, key + 'enabled') !== false,
            ...(raw.feather.space ? { space: raw.feather.space } : {}),
          };
        }
      }
      if (entry.slice) {
        const s = entry.slice,
          x = destinations(s.x, s.width),
          y = destinations(s.y, s.height);
        data.patches = [];
        for (let row = 0; row < s.y.length - 1; row++)
          for (let col = 0; col < s.x.length - 1; col++)
            data.patches.push({
              source: [s.x[col]!, s.y[row]!, s.x[col + 1]! - s.x[col]!, s.y[row + 1]! - s.y[row]!],
              target: [
                x[col]! +
                  (String(p.model.nodes[i]!.type) === 'image' ? p.model.nodes[i]!.raw.x0 : s.x[0]),
                y[row]! +
                  (String(p.model.nodes[i]!.type) === 'image' ? p.model.nodes[i]!.raw.y0 : s.y[0]),
                x[col + 1]! - x[col]!,
                y[row + 1]! - y[row]!,
              ],
              mode: s.modes?.[row * (s.x.length - 1) + col] ?? 'stretch',
            });
        if (data.geometry?.image) {
          data.geometry.image.fit = 'fill';
          data.geometry.width = s.x.at(-1)!;
          data.geometry.height = s.y.at(-1)!;
          data.geometry.x = 0;
          data.geometry.y = 0;
        }
      }
    },
  },
};
/** Outer bands retain size; interior bands share remaining space proportionally. Small targets shrink borders uniformly. */
export function destinations(c: number[], size: number): number[] {
  if (c.length <= 3) return c.map((v) => ((v - c[0]!) / (c.at(-1)! - c[0]!)) * size);
  const first = c[1]! - c[0]!,
    last = c.at(-1)! - c.at(-2)!,
    borders = first + last;
  const factor = Math.min(1, size / borders),
    middle = c.at(-2)! - c[1]!;
  return c.map((v, i) =>
    i === 0
      ? 0
      : i === c.length - 1
        ? size
        : first * factor + (middle ? ((v - c[1]!) / middle) * Math.max(0, size - borders) : 0),
  );
}
