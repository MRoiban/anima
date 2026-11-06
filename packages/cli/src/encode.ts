/// <reference lib="dom" />
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import type { AssetInfo } from './asset-info.ts';

// Chromium supplies JPEG/WebP encoders and the WebP decoder that resvg lacks.
async function browserImage(
  bytes: Buffer,
  info: AssetInfo,
  encode?: string,
  quality?: number,
): Promise<string | { width: number; height: number; data: number[] }> {
  const executablePath =
    process.env.CHROMIUM_PATH ??
    resolve(
      homedir(),
      '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    );
  const unavailable = () =>
    Object.assign(Error('cached Chromium image encoder/decoder is unavailable'), {
      code: 'build-encoder-unavailable',
    });
  if (!existsSync(executablePath)) throw unavailable();
  let browser;
  try {
    // Loaded on first use: importing Playwright at module load cost every CLI command ~0.3–0.5 s.
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ executablePath, headless: true });
  } catch {
    throw unavailable();
  }
  try {
    const page = await browser.newPage();
    return await page.evaluate(
      async ({ uri, encode, quality }) => {
        const image = new Image();
        image.src = uri;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        if (!encode)
          return {
            width: canvas.width,
            height: canvas.height,
            data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data),
          };
        const result = canvas.toDataURL('image/' + encode, quality);
        if (!result.startsWith('data:image/' + encode + ';'))
          throw Error('encoder returned a different format');
        return result.split(',')[1]!;
      },
      { uri: `data:${info.mime};base64,${bytes.toString('base64')}`, encode, quality },
    );
  } finally {
    await browser.close();
  }
}
export async function validateWebP(bytes: Buffer, info: AssetInfo): Promise<void> {
  await browserImage(bytes, info);
}
export async function encodeImage(
  bytes: Buffer,
  info: AssetInfo,
  encode: string,
  quality?: number,
): Promise<Buffer> {
  if (encode === 'png') {
    if (info.mime === 'image/webp') {
      const pixels = await browserImage(bytes, info);
      if (typeof pixels === 'string') throw Error('decoder returned no pixels');
      return PNG.sync.write({
        width: pixels.width,
        height: pixels.height,
        data: Buffer.from(pixels.data),
      } as PNG);
    }
    const uri = `data:${info.mime};base64,${bytes.toString('base64')}`;
    return Buffer.from(
      new Resvg(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}"><image href="${uri}" width="${info.width}" height="${info.height}"/></svg>`,
      )
        .render()
        .asPng(),
    );
  }
  const encoded = await browserImage(bytes, info, encode, quality);
  if (typeof encoded !== 'string') throw Error('encoder returned no bytes');
  return Buffer.from(encoded, 'base64');
}
