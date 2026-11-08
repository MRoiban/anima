// Browser regressions for P4 Rottweiler review findings (design/rottweiler/P4-LEDGER.md).
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type Page } from 'playwright-core';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type {} from '../../web/index.ts';
const root = new URL('../../../../', import.meta.url);
for (const [name, engine, executablePath] of [
  [
    'Chromium',
    chromium,
    process.env.CHROMIUM_PATH ??
      resolve(
        homedir(),
        '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
      ),
  ],
  [
    'Firefox',
    firefox,
    process.env.FIREFOX_PATH ??
      resolve(homedir(), '.cache/ms-playwright/firefox-1555/firefox/firefox'),
  ],
] as const)
  describe.skipIf(!existsSync(executablePath))(
    `canvas P4 review ${name}`,
    { timeout: 30000 },
    () => {
      let browser: Browser, page: Page, scripts: string[];
      beforeAll(async () => {
        scripts = await Promise.all(
          ['index', 'canvas'].map((n) =>
            bundle(new URL(`packages/web/src/${n}.ts`, root).pathname),
          ),
        );
        browser = await engine.launch({
          executablePath,
          headless: true,
          args: name === 'Chromium' ? ['--no-sandbox'] : [],
        });
      }, 30000);
      afterAll(async () => browser?.close());
      beforeEach(async () => {
        page = await browser.newPage({ deviceScaleFactor: 1 });
        await page.setContent(
          '<anima-icon renderer="canvas" paused style="display:block;width:200px;height:200px"></anima-icon>',
        );
        for (const s of scripts) await page.addScriptTag({ type: 'module', content: s });
        await page.waitForFunction(() => !!customElements.get('anima-icon'));
      });
      afterEach(async () => page.close());
      it('R2-07: clamps oversized rect radii per axis like SVG', async () => {
        const alpha = await page.evaluate(async () => {
          const i = document.querySelector('anima-icon')!;
          i.load({
            anima: '0.1',
            name: 'p4',
            grid: 20,
            nodes: [
              {
                id: 'r',
                type: 'rect',
                x0: 0,
                y0: 0,
                w: 20,
                h: 10,
                rx: 10,
                fill: { color: '#000' },
              },
            ],
          });
          await i.ready;
          const c = i.shadowRoot!.querySelector('canvas')!;
          const sample = () => {
            const s = c.width / 20;
            const at = (x: number, y: number) =>
              c.getContext('2d')!.getImageData(Math.floor(x * s), Math.floor(y * s), 1, 1).data[3];
            // Outside SVG's (10,5) elliptical corner; inside a circular radius-5 corner.
            return [at(3, 1), at(10, 5)];
          };
          for (let n = 0; n < 50; n++) {
            if (c.width && sample()[1] === 255) break;
            await new Promise((r) => requestAnimationFrame(r));
          }
          return sample();
        });
        expect(alpha).toEqual([0, 255]);
      });
    },
  );
