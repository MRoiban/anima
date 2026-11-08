import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox } from 'playwright-core';
import { PNG } from 'pngjs';
import { expect, it } from 'vitest';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
import { testFont } from '../../../../tools/test-font.ts';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import type {} from '../../web/index.ts';
const bundles = await Promise.all(
  [
    'index',
    'text',
    'input',
    'focus',
    'a11y',
    'text-input',
    'text-input-svg',
    'canvas',
    'text-input-canvas',
  ].map((e) => cachedBundle(resolve(`packages/web/src/${e}.ts`))),
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
    `${name} placeholder paint, default opacity and native editing recover SVG/canvas pixels`,
    async () => {
      const browser = await engine.launch({ executablePath, headless: true });
      try {
        const page = await browser.newPage();
        await page.setContent(
          '<anima-icon paused style="display:block;width:240px;height:240px"></anima-icon><anima-icon id="control" paused style="display:block;width:240px;height:240px"></anima-icon>',
        );
        await page.evaluate(async (b) => {
          document.fonts.add(
            await new FontFace(
              'Anima Test',
              Uint8Array.from(atob(b), (c) => c.charCodeAt(0)),
            ).load(),
          );
        }, testFont().toString('base64'));
        for (const content of bundles) await page.addScriptTag({ type: 'module', content });
        await page.waitForFunction(
          () =>
            ['text', 'textinput', 'focus', 'a11y'].every((m) =>
              (customElements.get('anima-icon') as typeof AnimaIcon).modules.has(m),
            ) && !!(customElements.get('anima-icon') as typeof AnimaIcon).renderers.canvas,
        );
        for (const renderer of ['svg', 'canvas'])
          for (const color of [null, '#ff0000']) {
            await page.evaluate(
              async ({ renderer, color }) => {
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
                  name: 'placeholder',
                  grid: 20,
                  requires: ['text', 'textinput', 'focus', 'a11y'],
                  nodes: [
                    {
                      id: 'q',
                      type: 'text',
                      x: 2,
                      y: 2,
                      sizing: 'fixed',
                      width: 12,
                      height: 4,
                      styles: { s: { font: 'Anima Test', size: 2, fill: { color: '#0000ff' } } },
                      runs: [{ text: '', style: 's' }],
                      textInput: {
                        placeholder: 'Find',
                        ...(color ? { placeholderColor: color } : {}),
                      },
                    },
                  ],
                });
                await loaded;
              },
              { renderer, color },
            );
            const placeholder = await page.locator('anima-icon').first().screenshot();
            await page.evaluate(
              async ({ renderer, color }) => {
                const icon = document.getElementById('control') as AnimaIcon;
                icon.setAttribute('renderer', renderer);
                const loaded = new Promise<void>((r) =>
                  icon.addEventListener('anima:load', () => r(), { once: true }),
                );
                icon.load({
                  anima: '0.1',
                  name: 'control',
                  grid: 20,
                  requires: ['text'],
                  nodes: [
                    {
                      id: 'q',
                      type: 'text',
                      x: 2,
                      y: 2,
                      sizing: 'fixed',
                      width: 12,
                      height: 4,
                      opacity: color ? 1 : 0.5,
                      styles: {
                        s: { font: 'Anima Test', size: 2, fill: { color: color ?? '#0000ff' } },
                      },
                      runs: [{ text: 'Find', style: 's' }],
                    },
                  ],
                });
                await loaded;
              },
              { renderer, color },
            );
            const actualPixels = PNG.sync.read(placeholder).data;
            const expectedPixels = PNG.sync.read(await page.locator('#control').screenshot()).data;
            let maxDiff = 0;
            for (let i = 0; i < actualPixels.length; i++)
              maxDiff = Math.max(maxDiff, Math.abs(actualPixels[i]! - expectedPixels[i]!));
            // Canvas isolates node opacity into a surface; glyph-only alpha draws directly.
            // The two compositing paths differ by one channel level at AA boundaries.
            expect(maxDiff, `${renderer}/${color}`).toBeLessThanOrEqual(
              renderer === 'canvas' && !color ? 1 : 0,
            );
            const attrs = await page.evaluate(() => {
              const svg = document.querySelector('anima-icon')!.shadowRoot!;
              return {
                fill: svg.querySelector('tspan')?.getAttribute('fill'),
                dim: svg.querySelector('g[opacity="0.5"]') !== null,
              };
            });
            if (renderer === 'svg')
              expect(attrs).toEqual({ fill: color ?? '#0000ff', dim: !color });
            await page.evaluate(() => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              const f = icon.textInput('q')!;
              f.value = 'Find';
              f.dispatchEvent(new Event('input'));
              icon.player!.step(0);
              icon.invalidate();
            });
            expect(await page.locator('anima-icon').first().screenshot()).not.toEqual(placeholder);
            await page.evaluate(() => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              const f = icon.textInput('q')!;
              f.value = '';
              f.dispatchEvent(new Event('input'));
              icon.player!.step(0);
              icon.invalidate();
            });
            expect(await page.locator('anima-icon').first().screenshot()).toEqual(placeholder);
          }
      } finally {
        await browser.close();
      }
    },
    30000,
  );
