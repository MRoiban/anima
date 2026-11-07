/// <reference lib="dom" />
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';
import type { AssetInfo } from './asset-info.ts';

// One lazy browser per command; callers own the lifetime, including exceptional exits.
export class ImageEncoder {
  #browser?: Promise<Browser>;
  async close(): Promise<void> {
    await (await this.#browser)?.close();
  }
  async browser(): Promise<Browser> {
    if (!this.#browser) {
      const executablePath =
        process.env.CHROMIUM_PATH ??
        resolve(
          homedir(),
          '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
        );
      this.#browser = (async () => {
        if (!existsSync(executablePath)) throw Error('missing executable');
        // Loaded on first use: importing Playwright at module load cost every CLI command ~0.3–0.5 s.
        const { chromium } = await import('playwright-core');
        return chromium.launch({ executablePath, headless: true });
      })().catch(() => {
        this.#browser = undefined;
        throw Object.assign(Error('cached Chromium image encoder/decoder is unavailable'), {
          code: 'build-encoder-unavailable',
          pointer: '',
          hint: 'install cached Playwright Chromium or set CHROMIUM_PATH to a Chromium executable',
        });
      });
    }
    return this.#browser;
  }
}
// Chromium supplies JPEG/WebP encoders and the WebP decoder that resvg lacks.
async function browserImage(
  bytes: Buffer,
  info: AssetInfo,
  encode?: string,
  quality?: number,
  session?: ImageEncoder,
): Promise<string | { width: number; height: number; data: number[] }> {
  const owned = session === undefined;
  session ??= new ImageEncoder();
  const browser = await session.browser();
  let page: Page | undefined;
  try {
    page = await browser.newPage();
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
    try {
      await page?.close();
    } finally {
      if (owned) await session.close();
    }
  }
}
export async function validateWebP(
  bytes: Buffer,
  info: AssetInfo,
  session?: ImageEncoder,
): Promise<void> {
  await browserImage(bytes, info, undefined, undefined, session);
}
export async function encodeImage(
  bytes: Buffer,
  info: AssetInfo,
  encode: string,
  quality?: number,
  session?: ImageEncoder,
): Promise<Buffer> {
  if (encode === 'png') {
    if (info.mime === 'image/webp') {
      const pixels = await browserImage(bytes, info, undefined, undefined, session);
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
  const encoded = await browserImage(bytes, info, encode, quality, session);
  if (typeof encoded !== 'string') throw Error('encoder returned no bytes');
  return Buffer.from(encoded, 'base64');
}
