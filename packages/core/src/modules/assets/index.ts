import type { Module } from '../../modules.ts';
import type { ObjShape, Shape } from '../../registry.ts';
import { NAME } from '../../registry.ts';
import { ptr } from '../../diag.ts';
import { VERBOSE as V } from '../../flags.ts';

export interface Asset {
  type: 'image' | 'font' | 'audio' | 'blob';
  source: string;
  storage?: 'embedded' | 'referenced';
  width?: number;
  height?: number;
}
const str = (of?: string[]): Shape => ({ k: 'str', of });
const num = (gt?: number): Shape => ({ k: 'num', gt });
const asset: ObjShape = {
  k: 'obj',
  p: {
    type: str(['image', 'font', 'audio', 'blob']),
    source: { k: 'str', markup: 'src' },
    storage: str(['embedded', 'referenced']),
    width: num(0),
    height: num(0),
  },
  req: ['type', 'source'],
};
export const fits = ['contain', 'cover', 'fill', 'none', 'scale-down', 'fit-width', 'fit-height'];
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
export const assets: Module & { resolvedAssets: typeof resolvedAssets } = {
  resolvedAssets,
  name: 'assets',
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
        x0: { ...num(), markup: 'x0' },
        y0: num(),
        width: num(0),
        height: num(0),
        fit: str(fits),
        align: str(aligns),
        sampling: str(['bilinear', 'nearest']),
      },
      props: { width: { type: 'number', min: 0 }, height: { type: 'number', min: 0 } },
      required: ['id', 'type', 'asset', 'x0', 'y0', 'width', 'height'],
    },
  ],
  load(_model, raw, d) {
    const records: Record<string, Asset> = raw.assets ?? {};
    for (const [name, a] of Object.entries(records)) {
      const p = ptr('/assets', name);
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
        a: Asset = (resolvedAssets.get(p.model) ?? p.model.doc.assets)[r.asset];
      data.geometry = {
        kind: 'image',
        x: r.x0,
        y: r.y0,
        width: p.num(i, 'width', r.width),
        height: p.num(i, 'height', r.height),
        image: {
          asset: r.asset,
          source: a.source,
          width: a.width,
          height: a.height,
          fit: r.fit ?? 'contain',
          align: r.align ?? 'center',
          sampling: r.sampling ?? 'bilinear',
        },
      };
    },
  },
};
