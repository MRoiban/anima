import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
const entries = [
  'index',
  'paint',
  'text',
  'input',
  'focus',
  'a11y',
  'text-input',
  'text-input-svg',
  'canvas',
  'text-input-canvas',
];
const bundles = await Promise.all(
  entries.map((e) => cachedBundle(resolve('packages/web/src/' + e + '.ts'))),
);
for (const [name, engine, executablePath] of [
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
    `${name} selected text has independent paint in SVG and canvas and clears on blur`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(
          '<anima-icon paused style="display:block;width:240px;height:240px"></anima-icon>',
        );
        await page.evaluate(
          async (bytes) => {
            document.fonts.add(await new FontFace('Anima Test', new Uint8Array(bytes)).load());
          },
          [...testFont()],
        );
        for (const content of bundles) await page.addScriptTag({ type: 'module', content });
        await page.waitForFunction(
          () => !!(document.querySelector('anima-icon') as AnimaIcon).textInput,
        );
        for (const renderer of ['svg', 'canvas'])
          for (const mode of ['color', 'style']) {
            await page.evaluate(
              async ({ renderer, mode }) => {
                const icon = document.querySelector('anima-icon') as AnimaIcon;
                icon.setAttribute('renderer', renderer);
                const loaded = new Promise<void>((r, reject) => {
                  icon.addEventListener('anima:load', () => r(), { once: true });
                  icon.addEventListener(
                    'anima:error',
                    (e) => reject(Error(JSON.stringify((e as CustomEvent).detail))),
                    { once: true },
                  );
                });
                icon.load({
                  anima: '0.1',
                  name: 'selection',
                  grid: 20,
                  requires: ['text', 'textinput', 'a11y', 'focus', 'paint'],
                  nodes: [
                    {
                      id: 'q',
                      type: 'text',
                      x: 2,
                      y: 2,
                      sizing: 'fixed',
                      width: 12,
                      height: 4,
                      styles: {
                        s: { font: 'Anima Test', size: 2, fill: { color: '#0000ff' } },
                        chosen: {
                          size: 99,
                          fill: {
                            type: 'linear',
                            x1: 0,
                            y1: 0,
                            x2: 12,
                            y2: 0,
                            stops: [
                              { position: 0, color: '#ff0000' },
                              { position: 1, color: '#ff0000' },
                            ],
                          },
                          stroke: { color: '#000', width: 0.1 },
                        },
                      },
                      runs: [{ text: 'ABCD', style: 's' }],
                      textInput: {
                        selectionColor: '#00ff00',
                        ...(mode === 'style'
                          ? { selectedTextStyle: 'chosen' }
                          : { selectedTextColor: '#ff0000' }),
                      },
                    },
                  ],
                });
                await loaded;
                const field = icon.textInput('q')!;
                field.focus();
                field.setSelectionRange(1, 3);
                field.dispatchEvent(new Event('select'));
                icon.player!.step(0);
                icon.invalidate();
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
              },
              { renderer, mode },
            );
            const png = PNG.sync.read(await page.locator('anima-icon').screenshot());
            const count = (r: number, g: number, b: number) => {
              let n = 0;
              for (let i = 0; i < png.data.length; i += 4)
                if (
                  png.data[i] === r &&
                  png.data[i + 1] === g &&
                  png.data[i + 2] === b &&
                  png.data[i + 3] === 255
                )
                  n++;
              return n;
            };
            expect(count(255, 0, 0), renderer + ' selected ink').toBeGreaterThan(100);
            expect(count(0, 0, 255), renderer + ' normal ink').toBeGreaterThan(100);
            expect(count(0, 255, 0), renderer + ' selection background').toBeGreaterThan(100);
            await page.evaluate(async () => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              icon.textInput('q')!.blur();
              icon.player!.step(0);
              icon.invalidate();
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            });
            const clear = PNG.sync.read(await page.locator('anima-icon').screenshot());
            let red = 0;
            for (let i = 0; i < clear.data.length; i += 4)
              if (clear.data[i] === 255 && clear.data[i + 1] === 0 && clear.data[i + 2] === 0)
                red++;
            expect(red).toBe(0);
          }
      } finally {
        await browser.close();
      }
    },
    30000,
  );
