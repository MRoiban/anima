import type { Geometry } from '../../../packages/core/src/draw.ts';
import { after } from '../manifest.ts';
import type { Module } from '../../../packages/core/src/modules.ts';
import type { ObjShape } from '../../../packages/core/src/registry.ts';
import { NAME } from '../../../packages/core/src/registry.ts';
import { ptr } from '../../../packages/core/src/diag.ts';
import { VERBOSE as V } from '../../../packages/core/src/flags.ts';

export interface Asset {
  type: 'image' | 'font' | 'audio' | 'blob';
  source: string;
  storage?: 'embedded' | 'referenced';
  width?: number;
  height?: number;
  size?: number;
  mime?: string;
  duration?: number;
  start?: number;
  end?: number;
  encode?: 'png' | 'jpeg' | 'webp';
  quality?: number;
  export?: boolean;
  metadata?: Record<string, unknown>;
}
/** Decoded dimensions are tied to resource identity, never authored layout or JSON. */
export const imagePixels = new WeakMap<Asset, [number, number]>();
export type ImageResource = NonNullable<Geometry['image']> & { pixels?: [number, number] };
const asset: ObjShape = {
  k: 'obj',
  p: {
    type: { k: 'str', of: ['image', 'font', 'audio', 'blob'] },
    source: { k: 'str', markup: 'src' },
    storage: { k: 'str', of: ['embedded', 'referenced'] },
    width: { k: 'num', gt: 0 },
    height: { k: 'num', gt: 0 },
    size: { k: 'num', min: 0, int: true },
    mime: { k: 'str' },
    duration: { k: 'num', min: 0 },
    start: { k: 'num', min: 0 },
    end: { k: 'num', gt: 0 },
    encode: { k: 'str', of: ['png', 'jpeg', 'webp'] },
    quality: { k: 'num', min: 0, max: 1 },
    export: { k: 'bool' },
    metadata: { k: 'map', of: { k: 'any' }, markup: 'metadata' },
  },
  req: ['type', 'source'],
};
export const fits = [
  'contain',
  'cover',
  'fill',
  'resize',
  'none',
  'scale-down',
  'fit-width',
  'fit-height',
];
export const aligns = [
  'center',
  'top-left',
  'top',
  'top-right',
  'left',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];
export function validDataURI(s: string): boolean {
  const m = /^data:([^,]*),(.*)$/s.exec(s);
  if (!m || !m[2]) return false;
  if (m[1]!.endsWith(';base64'))
    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(m[2]!);
  return !/%(?![0-9a-fA-F]{2})/.test(m[2]!);
}
export const resolvedAssets = new WeakMap<object, Record<string, Asset>>();
// seam(P7-7): per-load catalogs include unused lexical components without global resolver state.
export const assetCatalogs = new WeakMap<object, Map<object, Record<string, Asset>>>();
export const assets: Module & {
  resolvedAssets: typeof resolvedAssets;
  catalogs: typeof assetCatalogs;
} = {
  catalogs: assetCatalogs,
  resolvedAssets,
  name: 'assets',
  after,
  init(registry) {
    const components = registry.get('components') as
      import('../../components/core/index.ts').ComponentModule | undefined;
    if (components) {
      const previous = components.loadComponent;
      const key = components.componentKey;
      const catalogs = new WeakMap<object, number>();
      let serial = 0;
      components.componentKey = (model, name) => {
        const catalog = model.doc.assets ?? model.doc;
        if (!catalogs.has(catalog)) catalogs.set(catalog, ++serial);
        return (key?.(model, name) ?? name) + ':' + catalogs.get(catalog);
      };
      components.loadComponent = (parent, name, doc, shares, run, itemModel) => {
        if (parent.doc.assets) doc = { ...doc, assets: { ...parent.doc.assets, ...doc.assets } };
        return previous ? previous(parent, name, doc, shares, run, itemModel) : run(doc);
      };
    }
    return { ...this, init: undefined };
  },
  entries: [
    {
      target: 'document',
      shapes: { assets: { k: 'map', of: asset, key: NAME } },
      elements: {
        asset: {
          shape: {
            ...asset,
            p: { name: { k: 'str', re: NAME }, ...asset.p },
            req: ['name', ...asset.req!],
          },
        },
      },
    },
    {
      target: 'image',
      node: {},
      shapes: {
        asset: { k: 'str', re: NAME },
        x0: { ...{ k: 'num' }, markup: 'x0' },
        y0: { k: 'num' },
        width: { k: 'num', gt: 0 },
        height: { k: 'num', gt: 0 },
        fit: { k: 'str', of: fits },
        align: { k: 'str', of: aligns },
        sampling: { k: 'str', of: ['bilinear', 'nearest'] },
      },
      props: {
        width: { type: 'number', min: 0 },
        height: { type: 'number', min: 0 },
      },
      required: ['id', 'type', 'asset', 'x0', 'y0', 'width', 'height'],
    },
  ],
  model(node, key) {
    if (String(node.type) === 'image' && key === 'asset')
      return { prop: { type: 'string', feature: 'assets', discrete: true }, rest: node.raw.asset };
  },
  prepare(model) {
    if (model.doc.requires?.includes('assets')) model.doc.assets ??= {};
  },
  outline(p, i) {
    const n = p.model.nodes[i]!;
    if (String(n.type) !== 'image') return;
    const x = n.raw.x0,
      y = n.raw.y0;
    const right = x + p.num(i, 'width', n.raw.width);
    const bottom = y + p.num(i, 'height', n.raw.height);
    return [{ pts: [x, y, right, y, right, bottom, x, bottom], closed: true }];
  },
  fillContains(p, i, polys, x, y) {
    if (String(p.model.nodes[i]!.type) !== 'image') return;
    const [left, top, right, , , bottom] = polys[0]!.pts;
    return x >= left! && x <= right! && y >= top! && y <= bottom!;
  },
  load(_model, raw, d) {
    const records: Record<string, Asset> = raw.assets ?? {};
    for (const [name, a] of Object.entries(records)) {
      const p = ptr('/assets', name);
      for (const key of ['start', 'end', 'duration', 'encode', 'quality'] as const) {
        if (a[key] === undefined) continue;
        const image = key === 'encode' || key === 'quality';
        if (a.type !== (image ? 'image' : 'audio'))
          d.err(
            'asset-option',
            p + '/' + key,
            V && 'option is not valid for this asset type',
            V && 'use image encoding options on images and clip times on audio',
          );
      }
      if (a.quality !== undefined && !a.encode)
        d.err(
          'asset-option',
          p + '/quality',
          V && 'quality needs encode',
          V && 'choose jpeg, webp or png encoding',
        );
      if (
        a.end !== undefined &&
        (a.end <= (a.start ?? 0) || (a.duration !== undefined && a.end > a.duration))
      )
        d.err(
          'asset-clip',
          p + '/end',
          V && 'clip end must follow start and fit the source duration',
          V && 'use 0 <= start < end <= duration',
        );
      if (a.start !== undefined && a.duration !== undefined && a.start >= a.duration)
        d.err(
          'asset-clip',
          p + '/start',
          V && 'clip start is outside source duration',
          V && 'use a start smaller than duration',
        );
      if (!a.source.trim())
        d.err(
          'missing-source',
          p + '/source',
          V && 'asset source is empty',
          V && 'provide a data URI or URL',
        );
      else if (a.source.startsWith('data:') && !validDataURI(a.source))
        d.err(
          'bad-data-uri',
          p + '/source',
          V && 'invalid data URI',
          V && 'use a valid percent-encoded or base64 data URI',
        );
      else if (a.storage && (a.storage === 'embedded') !== a.source.startsWith('data:'))
        d.err(
          'asset-storage',
          p + '/storage',
          V && 'storage disagrees with source',
          V && 'embedded uses data:; referenced uses a URL',
        );
    }
    const visit = (nodes: typeof raw.nodes, base: string) =>
      nodes.forEach((n: (typeof raw.nodes)[number], i: number) => {
        const p = base + '/' + i;
        if (n.type === 'image') {
          if (!raw.requires?.includes('paint'))
            d.err(
              'undeclared-feature',
              p + '/type',
              V && 'image needs paint',
              V && 'add "paint" to requires',
            );
          const a = Object.hasOwn(records, n.asset) ? records[n.asset] : undefined;
          if (!a)
            d.err(
              'unknown-asset',
              p + '/asset',
              V && 'unknown image asset',
              V && 'declare it in assets',
            );
          else if (a.type !== 'image')
            d.err(
              'asset-type',
              p + '/asset',
              V && 'image node needs an image asset',
              V && 'use an asset with type image',
            );
        }
        if (n.children) visit(n.children, p + '/children');
      });
    visit(raw.nodes, '/nodes');
  },
  draw: {
    frame(p, i, data) {
      const n = p.model.nodes[i]!;
      if (String(n.type) !== 'image') return;
      const r = n.raw,
        id = String(p.prop(i, 'asset') ?? r.asset),
        catalog = resolvedAssets.get(p) ?? resolvedAssets.get(p.model) ?? p.model.doc.assets,
        a: Asset = catalog[id]?.type === 'image' ? catalog[id] : catalog[r.asset];
      data.geometry = {
        kind: 'image',
        x: r.x0,
        y: r.y0,
        width: p.num(i, 'width', r.width),
        height: p.num(i, 'height', r.height),
        image: {
          asset: id,
          source: a.source,
          width: a.width,
          height: a.height,
          fit: r.fit ?? 'contain',
          align: r.align ?? 'center',
          sampling: r.sampling ?? 'bilinear',
          pixels: imagePixels.get(a),
        } as ImageResource,
      };
    },
  },
};
