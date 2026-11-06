// CLI-only IO; the core never fetches assets.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { sniff } from './asset-info.ts';
import { encodeImage } from './encode.ts';
import type { Asset } from '@anima-format/core/assets';

export function embedAssets(
  doc: { assets?: Record<string, Asset> },
  file: string,
  imagesOnly = false,
): void {
  for (const a of Object.values(doc.assets ?? {})) {
    if ((imagesOnly && a.type !== 'image') || a.source.startsWith('data:')) continue;
    const url = new URL(a.source, pathToFileURL(resolve(file)));
    const bytes = readFileSync(url);
    const ext = url.pathname.split('.').pop()?.toLowerCase();
    const mime: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
    };
    a.source = `data:${mime[ext ?? ''] ?? 'application/octet-stream'};base64,${bytes.toString('base64')}`;
    a.storage = 'embedded';
  }
}
export async function imageDimensions(doc: { assets?: Record<string, Asset> }): Promise<void> {
  for (const a of Object.values(doc.assets ?? {})) {
    if (a.type !== 'image') continue;
    if (a.source.startsWith('data:image/webp;')) {
      const bytes = Buffer.from(a.source.slice(a.source.indexOf(',') + 1), 'base64');
      const png = await encodeImage(bytes, sniff(bytes), 'png');
      a.source = 'data:image/png;base64,' + png.toString('base64');
    }
    const escaped = a.source.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const r = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><image href="${escaped}"/></svg>`,
    );
    const box = r.getBBox();
    if (!box) throw new Error('cannot decode image asset');
    a.width ??= box.width;
    a.height ??= box.height;
  }
}
