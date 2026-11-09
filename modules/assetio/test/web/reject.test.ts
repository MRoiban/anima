// Review follow-up (found by the P3 Rottweiler lead): an asset loader that rejects with a plain Error
// (e.g. relative sources on a page without a base URL) must still fail the load visibly, so
// `icon.ready` settles and `anima:error` fires, instead of #fail throwing on a non-array.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import { cachedBundle } from '../../../../tools/browser-cache.ts';

let index = '',
  assets = '';
beforeAll(async () => {
  index = await cachedBundle(resolve('packages/web/src/index.ts'));
  assets = await cachedBundle(resolve('packages/web/src/assets.ts'));
}, 30000);

for (const [name, engine, paths] of [
  [
    'Chromium',
    chromium,
    [
      process.env.CHROMIUM_PATH,
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      ),
    ],
  ],
  [
    'Firefox',
    firefox,
    [
      process.env.FIREFOX_PATH,
      resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
    ],
  ],
] as const)
  describe(name + ' asset loader rejection', () => {
    it('reports a plain Error from the asset loader as asset-load and settles ready', async () => {
      const executablePath = paths.find((p) => p && existsSync(p));
      if (!executablePath) throw Error('browser absent');
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent('<anima-icon paused></anima-icon>');
        await page.addScriptTag({ type: 'module', content: index });
        await page.addScriptTag({ type: 'module', content: assets });
        await page.waitForFunction(() =>
          (customElements.get('anima-icon') as typeof AnimaIcon | undefined)?.modules.has('assets'),
        );
        const result = await page.evaluate(async () => {
          const Icon = customElements.get('anima-icon') as typeof AnimaIcon;
          Icon.loadAssets = async () => {
            throw new Error('Invalid URL');
          };
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const error = new Promise<string>((r) =>
            icon.addEventListener('anima:error', (e) =>
              r((e as CustomEvent).detail[0].code as string),
            ),
          );
          icon.load({
            anima: '0.1',
            name: 'reject',
            grid: 20,
            requires: ['assets'],
            assets: { pic: { type: 'image', source: 'pic.png', width: 8, height: 4 } },
            nodes: [{ id: 'r', type: 'rect', x0: 0, y0: 0, w: 2, h: 2, fill: { color: '#000' } }],
          });
          const settled = await Promise.race([
            icon.ready.then(
              () => 'resolved',
              () => 'rejected',
            ),
            new Promise((r) => setTimeout(() => r('pending'), 3000)),
          ]);
          return { code: await error, settled };
        });
        expect(result).toEqual({ code: 'asset-load', settled: 'rejected' });
      } finally {
        await browser.close();
      }
    }, 30000);
  });
