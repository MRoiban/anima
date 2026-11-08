import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';

// Rottweiler P5 R4-04: ordered paints render the same whether surface or composite loads first.
for (const [name, engine, cache] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const) {
  const executablePath = resolve(homedir(), cache);
  describe.skipIf(!existsSync(executablePath))(name + ' surface ordered paints', () => {
    for (const order of [
      ['index', 'surface', 'composite'],
      ['index', 'composite', 'surface'],
    ])
      it(
        'draws the later ordered fill on top: ' + order.join(','),
        async () => {
          const browser = await engine.launch({ executablePath, headless: true });
          try {
            const page = await browser.newPage();
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            await page.setContent(
              '<anima-icon paused style="display:block;width:24px;height:24px"></anima-icon>',
            );
            for (const n of order)
              await page.addScriptTag({
                type: 'module',
                content: await bundle(resolve(`packages/web/src/${n}.ts`)),
              });
            await page.waitForFunction(
              () =>
                (customElements.get('anima-icon') as typeof AnimaIcon | undefined)?.modules.has(
                  'surface',
                ) &&
                (customElements.get('anima-icon') as typeof AnimaIcon).modules.has('composite'),
            );
            const pixel = await page.evaluate(async () => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              icon.load({
                anima: '0.1',
                name: 'ordered-surface',
                grid: 24,
                requires: ['paint', 'surface', 'composite'],
                nodes: [
                  {
                    id: 'r',
                    type: 'rect',
                    x0: 4,
                    y0: 4,
                    w: 16,
                    h: 16,
                    paints: [
                      { fill: { color: '#ff0000', feather: { outer: 0 } } },
                      { fill: { color: '#0000ff' } },
                    ],
                  },
                ],
              });
              await icon.ready;
              icon.player!.step(0);
              icon.invalidate();
              const svg = icon.shadowRoot!.querySelector('svg')!;
              const image = new Image();
              image.src =
                'data:image/svg+xml,' +
                encodeURIComponent(new XMLSerializer().serializeToString(svg));
              await image.decode();
              const canvas = document.createElement('canvas');
              canvas.width = canvas.height = 24;
              const ctx = canvas.getContext('2d')!;
              ctx.drawImage(image, 0, 0, 24, 24);
              return [...ctx.getImageData(12, 12, 1, 1).data];
            });
            expect(pixel).toEqual([0, 0, 255, 255]);
            expect(errors).toEqual([]);
          } finally {
            await browser.close();
          }
        },
        30000,
      );
  });
}
