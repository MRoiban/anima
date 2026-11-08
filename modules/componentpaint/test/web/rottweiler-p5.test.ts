import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';

// Rottweiler P5 R3-01: paint-source players draw the host-resolved image, in SVG and Canvas.
// R4-02: each host keeps its own resolved source image. R5-02: reloads of forked models too. One bundle only: with separate bundles the
// source `<image>` loses its href (R4-01, deferred on the markup-libraries budget; see the ledger).
const modes = { 'one bundle': ['modules/componentpaint/test/web/assets-entry.ts'] };
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
    for (const [mode, entries] of Object.entries(modes))
      it(
        'resolves inherited source images per host through its resolver: ' + mode,
        async () => {
          const browser = await engine.launch({ executablePath, headless: true });
          try {
            const page = await browser.newPage();
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            await page.setContent(
              '<anima-icon paused style="width:24px;height:24px;display:block"></anima-icon>',
            );
            for (const entry of entries)
              await page.addScriptTag({ type: 'module', content: await bundle(resolve(entry)) });
            await page.waitForFunction(
              () =>
                (customElements.get('anima-icon') as typeof AnimaIcon | undefined)?.modules.has(
                  'componentpaint',
                ) && (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('assets'),
            );
            const result = await page.evaluate(async () => {
              const svg = (fill: string) =>
                'data:image/svg+xml,' +
                encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path fill="${fill}" d="M0 0H24V24H0Z"/></svg>`,
                );
              const red = svg('red'),
                blue = svg('blue'),
                lime = svg('lime');
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              icon.assets = () => blue;
              const doc = {
                anima: '0.1',
                name: 'paint-assets',
                grid: 24,
                requires: ['components', 'paint', 'componentpaint', 'assets'],
                assets: { pic: { type: 'image', source: red, width: 24, height: 24 } },
                components: {
                  tile: {
                    grid: 24,
                    timelines: {
                      run: {
                        duration: 1,
                        tracks: {
                          'im.x': [
                            [0, 0],
                            [1, 1],
                          ],
                        },
                      },
                    },
                    machine: {
                      layers: { main: { initial: 'play', states: { play: { play: 'run' } } } },
                    },
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
              };
              icon.load(doc);
              await icon.ready;
              icon.player!.step(0);
              icon.invalidate();
              const href = (i: AnimaIcon) =>
                i.shadowRoot!.querySelector('image')?.getAttribute('href');
              const first = href(icon) === blue;
              const other = document.createElement('anima-icon') as AnimaIcon;
              other.setAttribute('paused', '');
              other.assets = () => lime;
              document.body.append(other);
              other.load(doc);
              await other.ready;
              other.player!.step(0);
              other.invalidate();
              icon.player!.step(0.1);
              icon.invalidate();
              const hrefs = [first, href(icon) === blue, href(other) === lime];
              // R5-02: reloading a player's own (forked) model still resolves its paint sources.
              other.assets = () => blue;
              const reloaded = new Promise((done) =>
                other.addEventListener('anima:load', done, { once: true }),
              );
              other.loadModel(other.player!.model);
              await reloaded;
              other.player!.step(0);
              other.invalidate();
              hrefs.push(href(other) === blue);
              icon.setAttribute('renderer', 'canvas');
              const pixel = async () => {
                icon.invalidate();
                await new Promise(requestAnimationFrame);
                const canvas = icon.shadowRoot!.querySelector('canvas');
                return canvas ? [...canvas.getContext('2d')!.getImageData(12, 12, 1, 1).data] : [];
              };
              let canvas: number[] = [];
              for (let i = 0; i < 100 && canvas.join() !== '0,0,255,255'; i++)
                canvas = await pixel();
              return { hrefs, canvas };
            });
            expect(result).toEqual({ hrefs: [true, true, true, true], canvas: [0, 0, 255, 255] });
            expect(errors).toEqual([]);
          } finally {
            await browser.close();
          }
        },
        30000,
      );
  });
}
