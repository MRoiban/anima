import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import type { Asset } from '@anima-format/core/assets';
import type { Diagnostic } from '@anima-format/core';
import { sniff } from './asset-info.ts';
import { encodeImage, validateWebP } from './encode.ts';

export async function buildAssets(
  doc: { assets?: Record<string, Asset> },
  file: string,
  embed: boolean,
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  for (const [name, asset] of Object.entries(doc.assets ?? {})) {
    if (asset.export === false) {
      // Keep reference identity, but never carry an excluded in-band payload into the build.
      if (/^\s*data:/i.test(asset.source)) {
        asset.source = 'anima:' + name;
        asset.storage = 'referenced';
      }
      continue;
    }
    const pointer = '/assets/' + name.replaceAll('~', '~0').replaceAll('/', '~1');
    let field = '/source';
    try {
      const url = new URL(asset.source, pathToFileURL(resolve(file)));
      // Disk builds never fetch network assets. Encoding requires local bytes.
      if (!['file:', 'data:'].includes(url.protocol)) {
        if (embed || asset.encode) throw Error('disk build cannot fetch remote assets');
        continue;
      }
      let bytes: Buffer;
      if (url.protocol === 'data:') {
        const comma = asset.source.indexOf(',');
        bytes = asset.source.slice(0, comma).endsWith(';base64')
          ? Buffer.from(asset.source.slice(comma + 1), 'base64')
          : Buffer.concat(
              [...asset.source.slice(comma + 1).matchAll(/%([0-9a-fA-F]{2})|([^%]+)/g)].map((m) =>
                m[1] ? Buffer.from([parseInt(m[1], 16)]) : Buffer.from(m[2]!),
              ),
            );
      } else bytes = readFileSync(url);
      let info = sniff(bytes);
      const expected: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.flac': 'audio/flac',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
      };
      const mime =
        url.protocol === 'data:'
          ? /^data:([^;,]+)/.exec(asset.source)?.[1]
          : expected[extname(url.pathname).toLowerCase()];
      if (info.mime === 'application/octet-stream' && asset.type === 'font')
        info = { ...info, mime: asset.mime ?? mime ?? 'application/octet-stream' };
      if (
        info.mime === 'application/octet-stream' &&
        mime === 'image/svg+xml' &&
        /<svg(?:\s|>)/.test(bytes.toString('utf8'))
      )
        info = { ...info, mime: 'image/svg+xml' };
      if (
        (mime && expected[extname(url.pathname).toLowerCase()] && mime !== info.mime) ||
        (mime &&
          /^(image\/(png|jpeg|webp)|audio\/(wav|mpeg|flac))$/.test(mime) &&
          mime !== info.mime) ||
        (asset.mime && asset.mime !== info.mime)
      )
        throw Object.assign(Error('asset MIME/extension disagrees with its bytes'), {
          code: 'asset-format',
        });
      if (
        asset.type === 'image' &&
        info.mime.startsWith('image/') &&
        info.mime !== 'image/svg+xml'
      ) {
        if (!info.width || !info.height) throw Error('image dimensions must be positive');
        // Header sniffing alone cannot establish that the compressed pixels decode.
        const uri = `data:${info.mime};base64,${bytes.toString('base64')}`;
        const box =
          info.mime === 'image/gif'
            ? true
            : info.mime === 'image/webp'
              ? (await validateWebP(bytes, info), true)
              : new Resvg(
                  `<svg xmlns="http://www.w3.org/2000/svg"><image href="${uri}"/></svg>`,
                ).getBBox();
        if (!box) throw Error('cannot decode image pixels');
      } else if (asset.type === 'image' && mime !== 'image/svg+xml')
        throw Object.assign(Error('image source has no supported image signature'), {
          code: 'asset-format',
        });
      if (asset.type === 'audio' && !info.mime.startsWith('audio/'))
        throw Object.assign(Error('audio source has no supported audio signature'), {
          code: 'asset-format',
        });
      if (
        info.duration !== undefined &&
        ((asset.end !== undefined && asset.end > info.duration) ||
          (asset.start ?? 0) >= info.duration)
      ) {
        field = asset.end !== undefined && asset.end > info.duration ? '/end' : '/start';
        throw Object.assign(Error('audio clip exceeds inspected source duration'), {
          code: 'asset-clip',
        });
      }
      if (asset.encode) {
        field = '/encode';
        if (
          asset.type !== 'image' ||
          !['image/png', 'image/jpeg', 'image/webp'].includes(info.mime)
        )
          throw Object.assign(Error('encode needs a PNG/JPEG/WebP image'), {
            code: 'asset-format',
          });
        bytes = await encodeImage(bytes, info, asset.encode, asset.quality);
        info = sniff(bytes);
      }
      Object.assign(
        asset,
        { mime: info.mime, size: info.size },
        info.duration === undefined ? {} : { duration: info.duration },
      );
      if (embed || asset.encode) {
        asset.source = `data:${info.mime};base64,${bytes.toString('base64')}`;
        asset.storage = 'embedded';
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      diagnostics.push({
        code:
          code === 'build-encoder-unavailable' || code === 'asset-format' || code === 'asset-clip'
            ? code
            : 'asset-load',
        severity: 'error',
        pointer: code === 'ENOENT' ? '/assets' : pointer + field,
        message: error instanceof Error ? error.message : 'cannot build asset',
        hint:
          code === 'build-encoder-unavailable'
            ? 'set CHROMIUM_PATH to the cached headless Chromium executable'
            : 'check source bytes, MIME, extension and encoding options relative to the document',
      });
    }
  }
  return diagnostics;
}
