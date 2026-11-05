import '@anima-format/core/all';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type BrowserType } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../tools/browser-cache.ts';
import { compile } from '../../markup/src/index.ts';
import { PNG } from 'pngjs';
import type { AnimaIcon } from '../src/index.ts';

const browsers: [string, BrowserType, string | undefined][] = [
  [
    'Chromium',
    chromium,
    process.env.CHROMIUM_PATH ??
      [
        resolve(
          homedir(),
          '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
        ),
        chromium.executablePath(),
      ].find(existsSync),
  ],
  [
    'Firefox',
    firefox,
    process.env.FIREFOX_PATH ??
      [
        resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
        firefox.executablePath(),
      ].find(existsSync),
  ],
];
for (const [name, type, executablePath] of browsers) {
  describe.skipIf(!executablePath)(name + ' images', () => {
    it('paints every fit, embedded sources make no requests, resolver replaces assets and failures emit errors', async () => {
      const browser = await type.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage({ deviceScaleFactor: 1 });
        const requests: string[] = [];
        page.on('request', (r) => requests.push(r.url()));
        await page.route('https://anima.test/**', (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: '<anima-icon style="width:240px;height:240px"></anima-icon>',
          }),
        );
        await page.goto('https://anima.test/');
        await page.addScriptTag({
          type: 'module',
          content: await bundle(resolve('packages/web/src/paint.ts')),
        });
        await page.addScriptTag({
          type: 'module',
          content: await bundle(resolve('packages/web/src/assets.ts')),
        });
        const doc = compile(readFileSync(resolve('examples/photo.animl'), 'utf8')).doc!;
        const sizes: Record<string, number[]> = {
          contain: [20, 10],
          cover: [40, 20],
          fill: [20, 20],
          none: [8, 4],
          'scale-down': [8, 4],
          'fit-width': [20, 10],
          'fit-height': [40, 20],
        };
        for (const [fit, size] of Object.entries(sizes)) {
          const got = await page.evaluate(
            async ({ doc, fit }) => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              const d = structuredClone(doc) as { nodes: { fit: string }[] };
              d.nodes[0]!.fit = fit;
              const done = new Promise<void>((res) =>
                icon.addEventListener('anima:load', () => res(), { once: true }),
              );
              icon.load(d);
              await done;
              const image = icon.shadowRoot!.querySelector('image')!;
              return [Number(image.getAttribute('width')), Number(image.getAttribute('height'))];
            },
            { doc, fit },
          );
          expect(got).toEqual(size);
          const png = PNG.sync.read(await page.locator('anima-icon').screenshot());
          const index = (120 * png.width + 120) * 4;
          expect([...png.data.slice(index, index + 3)]).toEqual([255, 40, 0]);
        }
        expect(requests).toEqual(['https://anima.test/']);
        const relative = structuredClone(doc) as {
          assets: Record<
            string,
            { source: string; storage?: string; width?: number; height?: number }
          >;
        };
        relative.assets.photo = {
          type: 'image',
          source: 'photo.png',
        } as typeof relative.assets.photo;
        const uri = (doc as { assets: Record<string, { source: string }> }).assets.photo!.source;
        await page.route('https://anima.test/icons/photo.png', (route) =>
          route.fulfill({
            contentType: 'image/png',
            body: Buffer.from(uri.split(',')[1]!, 'base64'),
          }),
        );
        await page.route('https://anima.test/icons/doc.ani', (route) =>
          route.fulfill({ contentType: 'application/json', body: JSON.stringify(relative) }),
        );
        const dimensions = await page.evaluate(async () => {
          const icon = document.createElement('anima-icon');
          const done = new Promise<void>((res) =>
            icon.addEventListener('anima:load', () => res(), { once: true }),
          );
          document.body.append(icon);
          icon.setAttribute('src', 'https://anima.test/icons/doc.ani');
          await done;
          const image = icon.shadowRoot!.querySelector('image')!;
          const result = [
            image.getAttribute('href'),
            image.getAttribute('width'),
            image.getAttribute('height'),
          ];
          icon.destroy();
          icon.remove();
          return result;
        });
        expect(dimensions).toEqual(['https://anima.test/icons/photo.png', '20', '10']);
        const replaced = await page.evaluate(async (d) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          let calls = 0;
          icon.assets = (_name, _info) => {
            calls++;
            return new Blob(
              [
                `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4"><rect width="8" height="4" fill="blue"/></svg>`,
              ],
              { type: 'image/svg+xml' },
            );
          };
          const done = new Promise<void>((res) =>
            icon.addEventListener('anima:load', () => res(), { once: true }),
          );
          icon.load(d);
          await done;
          return {
            calls,
            href: icon.shadowRoot!.querySelector('image')!.getAttribute('href'),
            authored: icon.player!.model.doc.assets.photo.source,
          };
        }, doc);
        expect(replaced.authored).toBe(uri);
        expect(replaced.calls).toBe(1);
        expect(replaced.href).toMatch(/^data:image\/svg/);
        const png = PNG.sync.read(await page.locator('anima-icon').screenshot());
        expect([
          ...png.data.slice((120 * png.width + 120) * 4, (120 * png.width + 120) * 4 + 3),
        ]).toEqual([0, 0, 255]);
        const error = await page.evaluate(async (d) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          icon.assets = () => {
            throw new Error('host failure');
          };
          const error = new Promise<unknown>((res) =>
            icon.addEventListener('anima:error', (e) => res((e as CustomEvent).detail), {
              once: true,
            }),
          );
          icon.load(d);
          return error;
        }, doc);
        expect(error).toEqual([
          expect.objectContaining({ code: 'asset-load', pointer: '/assets/photo/source' }),
        ]);
      } finally {
        await browser.close();
      }
    }, 30000);
  });
}
