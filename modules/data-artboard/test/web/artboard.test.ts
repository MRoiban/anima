import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser } from 'playwright-core';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import { cachedBundle } from '../../../../tools/browser-cache.ts';
const doc = JSON.parse(readFileSync('spec/conformance/data-host-artboard/case.ani', 'utf8'));
for (const [name, engine, executable] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const)
  describe(name + ' bindable artboards', () => {
    let browser: Browser;
    const bundles = new Map<string, string>();
    beforeAll(async () => {
      await Promise.all(
        [
          'index',
          'components',
          'bind',
          'data',
          'host',
          'data-artboard',
          'canvas',
          'markup-data-artboard',
        ].map(async (entry) => {
          bundles.set(entry, await cachedBundle(resolve('packages/web/src/' + entry + '.ts')));
        }),
      );
      browser = await engine.launch({
        executablePath: [resolve(homedir(), executable), engine.executablePath()].find(existsSync),
        headless: true,
      });
    }, 30_000);
    afterAll(async () => {
      await browser?.close();
    });
    for (const order of [
      ['index', 'components', 'bind', 'data', 'host', 'data-artboard'],
      ['index', 'data-artboard', 'host', 'data', 'bind', 'components'],
    ])
      it(
        'draws local and external swaps in SVG and canvas: ' + order.join(','),
        async () => {
          const page = await browser.newPage();
          try {
            await page.setContent(
              '<anima-icon auto-bind style="display:block;width:200px;height:200px"></anima-icon><anima-icon id="source" auto-bind></anima-icon>',
            );
            for (const entry of [...order, 'canvas', 'markup-data-artboard'])
              await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
            await page.waitForFunction(
              () =>
                ['components', 'data', 'host', 'nested', 'dataartboard'].every((n) =>
                  (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has(n),
                ),
              {},
              { polling: 10 },
            );
            await page.evaluate((document) => {
              const icon = window.document.querySelector('anima-icon') as AnimaIcon;
              const errors = icon.load(document).filter((d) => d.severity === 'error');
              if (errors.length) throw Error(JSON.stringify(errors));
            }, doc);
            await expect
              .poll(() =>
                page.evaluate(() =>
                  document
                    .querySelector('anima-icon')!
                    .shadowRoot!.querySelector('circle')
                    ?.getAttribute('r'),
                ),
              )
              .toBe('2');
            await page.evaluate(() => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              icon.data.artboard('content').set('back');
              icon.player!.step(0);
              icon.invalidate();
            });
            await expect
              .poll(() =>
                page.evaluate(() =>
                  document
                    .querySelector('anima-icon')!
                    .shadowRoot!.querySelector('rect')
                    ?.getAttribute('width'),
                ),
              )
              .toBe('3');
            await page.evaluate((document) => {
              const target = window.document.querySelector('anima-icon') as AnimaIcon;
              const source = window.document.querySelector('#source') as AnimaIcon;
              document.components.front = {
                grid: 20,
                nodes: [
                  {
                    id: 'foreign',
                    type: 'circle',
                    center: [10, 10],
                    r: 7,
                    fill: { color: '#00ff00' },
                  },
                ],
              };
              const errors = source.load(document).filter((d) => d.severity === 'error');
              if (errors.length) throw Error(JSON.stringify(errors));
              target.data.artboard('content').set(target.component(source.player!.model, 'front'));
              target.player!.step(0);
              target.invalidate();
            }, doc);
            await expect
              .poll(() =>
                page.evaluate(() =>
                  document
                    .querySelector('anima-icon')!
                    .shadowRoot!.querySelector('circle')
                    ?.getAttribute('r'),
                ),
              )
              .toBe('7');
            // Reloading/detaching the source must not change the selected target model.
            await page.evaluate((original) => {
              const source = document.querySelector('#source') as AnimaIcon;
              const replacement = structuredClone(original);
              replacement.components.front = {
                grid: 20,
                nodes: [
                  {
                    id: 'replacement',
                    type: 'circle',
                    center: [10, 10],
                    r: 1,
                    fill: { color: '#0000ff' },
                  },
                ],
              };
              const errors = source.load(replacement).filter((d) => d.severity === 'error');
              if (errors.length) throw Error(JSON.stringify(errors));
              source.remove();
            }, doc);
            const pixel = await page.evaluate(async () => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              icon.setAttribute('renderer', 'canvas');
              icon.player!.step(0);
              icon.invalidate();
              await new Promise<void>((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
              );
              const canvas = icon.shadowRoot!.querySelector('canvas')!;
              return [...canvas.getContext('2d')!.getImageData(100, 100, 1, 1).data];
            });
            expect(pixel).toEqual([0, 255, 0, 255]);
          } finally {
            await page.close();
          }
          // Eight separate bundles, three document loads and SVG/canvas round trips.
          // This is an end-to-end deadline, not a performance acceptance threshold.
        },
        20_000,
      );
    it('compiles the artboard AniML property in the browser', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent('<anima-icon auto-bind></anima-icon>');
        for (const entry of [
          'index',
          'components',
          'data',
          'bind',
          'host',
          'data-artboard',
          'markup-data-artboard',
        ])
          await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
        await page.waitForFunction(() =>
          (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has('dataartboard'),
        );
        const errors = await page.evaluate(
          async (source) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            return icon.load(source, true).filter((d) => d.severity === 'error');
          },
          readFileSync('spec/conformance/data-host-artboard/case.animl', 'utf8'),
        );
        expect(errors).toEqual([]);
        await expect
          .poll(() =>
            page.evaluate(() =>
              document
                .querySelector('anima-icon')!
                .shadowRoot!.querySelector('circle')
                ?.getAttribute('r'),
            ),
          )
          .toBe('2');
      } finally {
        await page.close();
      }
    });
  });
