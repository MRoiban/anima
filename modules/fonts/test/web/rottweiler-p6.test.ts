// Rottweiler P6 regressions (design/rottweiler/P6-LEDGER.md).
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
for (const [name, browserType, executablePath] of [
  [
    'Chromium',
    chromium,
    resolve(
      homedir(),
      '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
    ),
  ],
  ['Firefox', firefox, resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox')],
] as const)
  it.skipIf(!existsSync(executablePath))(
    `${name}: R1-09 with the text consumer, reconnecting a host restores its named font faces; a reload does not`,
    async () => {
      const browser = await browserType.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent('<anima-icon paused></anima-icon>');
        for (const entry of ['assets', 'fonts', 'fonts-text'])
          await page.addScriptTag({
            type: 'module',
            content: await bundle(resolve('packages/web/src/' + entry + '.ts')),
          });
        await page.waitForFunction(
          () =>
            !!Object.getOwnPropertyDescriptor(
              (customElements.get('anima-icon') as typeof AnimaIcon).prototype,
              'fonts',
            ),
        );
        const result = await page.evaluate(
          async (bytes) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const doc = (asset: boolean) => ({
              anima: '0.1',
              name: 'fonts',
              grid: 20,
              requires: ['assets', 'fonts'],
              assets: asset
                ? {
                    test: {
                      type: 'font',
                      source: 'data:font/ttf;base64,' + btoa(String.fromCharCode(...bytes)),
                    },
                  }
                : {},
              nodes: [{ id: 'dot', type: 'circle', center: [10, 10], r: 1 }],
            });
            const load = (d: object) =>
              new Promise<void>((res) => {
                icon.addEventListener('anima:load', () => res(), { once: true });
                icon.load(d);
              });
            const spec = {
              family: 'test',
              size: 10,
              weight: 400,
              style: 'normal' as const,
              tracking: 0,
            };
            const state = () => [icon.fonts.cssFont(spec).fontFamily, document.fonts.size];
            await load(doc(true));
            const loaded = state();
            icon.remove();
            const detached = document.fonts.size;
            document.body.append(icon);
            const reconnected = state();
            // Two disconnects without a font use in between keep the first snapshot.
            icon.remove();
            document.body.append(icon);
            icon.remove();
            document.body.append(icon);
            const twice = state();
            await load(doc(false));
            return { loaded, detached, reconnected, twice, reloaded: state() };
          },
          [...testFont()],
        );
        expect(result.loaded).toEqual([expect.stringMatching(/^"anima-font-\d+"$/), 1]);
        expect(result.detached).toBe(0);
        expect(result.reconnected).toEqual(result.loaded);
        expect(result.twice).toEqual(result.loaded);
        expect(result.reloaded).toEqual(['test', 0]);
      } finally {
        await browser.close();
      }
    },
    30000,
  );
