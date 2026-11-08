import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';

// Rottweiler P5 R3-01: paint-source players draw the host-resolved image, in SVG and Canvas.
for (const [name, engine, cache] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const) {
  const executablePath = resolve(homedir(), cache);
  describe.skipIf(!existsSync(executablePath))(name + ' component paint assets', () => {
    // One bundle: separate-bundle component paint sources drop image hrefs (pre-existing, see ledger).
    it('resolves inherited source images through the host resolver', async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.setContent(
          '<anima-icon paused style="width:24px;height:24px;display:block"></anima-icon>',
        );
        await page.addScriptTag({
          type: 'module',
          content: await bundle(resolve('modules/componentpaint/test/web/assets-entry.ts')),
        });
        await page.waitForFunction(() =>
          (customElements.get('anima-icon') as typeof AnimaIcon | undefined)?.modules.has(
            'componentpaint',
          ),
        );
        const result = await page.evaluate(async () => {
          const svg = (fill: string) =>
            'data:image/svg+xml,' +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path fill="${fill}" d="M0 0H24V24H0Z"/></svg>`,
            );
          const red = svg('red'),
            blue = svg('blue');
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          icon.assets = () => blue;
          icon.load({
            anima: '0.1',
            name: 'paint-assets',
            grid: 24,
            requires: ['components', 'paint', 'componentpaint', 'assets'],
            assets: { pic: { type: 'image', source: red, width: 24, height: 24 } },
            components: {
              tile: {
                grid: 24,
                nodes: [
                  {
                    id: 'im',
                    type: 'image',
                    asset: 'pic',
                    x0: 0,
                    y0: 0,
                    width: 24,
                    height: 24,
                  },
                ],
              },
            },
            nodes: [
              {
                id: 'rect',
                type: 'rect',
                x0: 0,
                y0: 0,
                w: 24,
                h: 24,
                fill: { paint: 'component:tile' },
              },
            ],
          });
          await icon.ready;
          icon.player!.step(0);
          icon.invalidate();
          const hrefs = [...icon.shadowRoot!.querySelectorAll('image')].map((e) =>
            e.getAttribute('href')?.includes('blue'),
          );
          icon.setAttribute('renderer', 'canvas');
          const pixel = async () => {
            icon.invalidate();
            await new Promise(requestAnimationFrame);
            const canvas = icon.shadowRoot!.querySelector('canvas');
            return canvas ? [...canvas.getContext('2d')!.getImageData(12, 12, 1, 1).data] : [];
          };
          let canvas: number[] = [];
          for (let i = 0; i < 100 && canvas.join() !== '0,0,255,255'; i++) canvas = await pixel();
          return { hrefs, canvas };
        });
        expect(result).toEqual({ hrefs: [true], canvas: [0, 0, 255, 255] });
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    }, 30000);
  });
}
