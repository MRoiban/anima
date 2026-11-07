import { existsSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser } from 'playwright-core';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AnimaIcon } from '../../../../packages/web/src/index.ts';
import { cachedBundle as bundle } from '../../../../tools/browser-cache.ts';
for (const [name, engine, cache] of [
  [
    'Chromium',
    chromium,
    '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  ],
  ['Firefox', firefox, '.cache/ms-playwright/firefox-1555/firefox/firefox'],
] as const)
  describe(name + ' nested components', () => {
    let browser: Browser;
    const bundles = new Map<string, string>();
    beforeAll(async () => {
      await Promise.all(
        ['index', 'components', 'data', 'bind', 'nested', 'canvas', 'markup'].map(async (entry) =>
          bundles.set(entry, await bundle(resolve('packages/web/src/' + entry + '.ts'))),
        ),
      );
      const executablePath = [resolve(homedir(), cache), engine.executablePath()].find(existsSync);
      if (!executablePath) throw Error('browser absent');
      browser = await engine.launch({ executablePath, headless: true });
    });
    afterAll(async () => {
      await browser?.close();
    });
    for (const order of [
      ['index', 'components', 'data', 'bind', 'nested'],
      ['index', 'nested', 'data', 'bind', 'components'],
    ])
      it('swaps live SVG/canvas instances with separate bundles: ' + order.join(','), async () => {
        const page = await browser.newPage();
        try {
          await page.setContent(
            '<anima-icon style="display:block;width:200px;height:200px"></anima-icon>',
          );
          for (const entry of [...order, 'canvas'])
            await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
          await page.waitForFunction(
            () =>
              ['components', 'data', 'bind', 'nested'].every((n) =>
                (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has(n),
              ),
            {},
            { polling: 10 },
          );
          const document = JSON.parse(
            readFileSync('spec/conformance/data-property-artboard/case.ani', 'utf8'),
          );
          await page.evaluate((doc) => {
            const icon = window.document.querySelector('anima-icon') as AnimaIcon;
            const ds = icon.load(doc);
            if (ds.some((d) => d.severity === 'error')) throw Error(JSON.stringify(ds));
          }, document);
          await expect
            .poll(() =>
              page.evaluate(() =>
                window.document
                  .querySelector('anima-icon')!
                  .shadowRoot!.querySelector('circle')
                  ?.getAttribute('r'),
              ),
            )
            .toBe('2');
          await page.evaluate(() => {
            const icon = window.document.querySelector('anima-icon') as AnimaIcon;
            icon.player!.set('$card', 'box');
            icon.player!.step(0);
            icon.invalidate();
          });
          await expect
            .poll(() =>
              page.evaluate(
                () =>
                  !!window.document.querySelector('anima-icon')!.shadowRoot!.querySelector('rect'),
              ),
            )
            .toBe(true);
          expect(
            await page.evaluate(
              () =>
                !!window.document.querySelector('anima-icon')!.shadowRoot!.querySelector('circle'),
            ),
          ).toBe(false);
          await page.evaluate(() => {
            const icon = window.document.querySelector('anima-icon') as AnimaIcon;
            icon.setAttribute('renderer', 'canvas');
            icon.player!.step(0);
            icon.invalidate();
          });
          const pixels = await page.evaluate(() => {
            const canvas = window.document
              .querySelector('anima-icon')!
              .shadowRoot!.querySelector('canvas')!;
            return Array.from(canvas.getContext('2d')!.getImageData(5, 5, 1, 1).data);
          });
          expect(pixels).toEqual([255, 0, 0, 255]);
          await page.evaluate(() => {
            const icon = window.document.querySelector('anima-icon') as AnimaIcon;
            icon.player!.set('$card', 'row');
            icon.player!.step(0);
            icon.invalidate();
            icon.setAttribute('renderer', 'svg');
          });
          await expect
            .poll(() =>
              page.evaluate(() =>
                window.document
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
    it('fits child drawing and pointer hit coordinates and exposes live outputs', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent(
          '<anima-icon style="display:block;width:200px;height:200px"></anima-icon>',
        );
        for (const entry of ['index', 'components', 'bind', 'nested'])
          await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
        await page.waitForFunction(
          () =>
            ['components', 'bind', 'nested'].every((n) =>
              (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has(n),
            ),
          {},
          { polling: 10 },
        );
        await page.evaluate(
          (doc) => {
            const icon = window.document.querySelector('anima-icon') as AnimaIcon;
            icon.load(doc);
          },
          JSON.parse(readFileSync('spec/conformance/components-leaf-fit/case.ani', 'utf8')),
        );
        await expect
          .poll(() =>
            page.evaluate(() =>
              window.document
                .querySelector('anima-icon')!
                .shadowRoot!.querySelector('circle')
                ?.getAttribute('r'),
            ),
          )
          .toBe('2');
        const box = await page.locator('anima-icon').boundingBox();
        await page.mouse.click(box!.x + 150, box!.y + 50);
        await expect
          .poll(() =>
            page.evaluate(() =>
              window.document
                .querySelector('anima-icon')!
                .shadowRoot!.querySelector('circle')
                ?.getAttribute('r'),
            ),
          )
          .toBe('1');
      } finally {
        await page.close();
      }
    });

    it('compiles component properties, remapped clocks and output elements in a lean browser', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent(
          '<anima-icon style="display:block;width:300px;height:300px"></anima-icon>',
        );
        for (const entry of ['index', 'nested', 'components', 'bind', 'data', 'markup'])
          await page.addScriptTag({ type: 'module', content: bundles.get(entry)! });
        await page.waitForFunction(
          () =>
            ['components', 'bind', 'data', 'nested'].every((n) =>
              (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has(n),
            ),
          {},
          { polling: 10 },
        );
        await page.evaluate(
          (xml) => {
            const icon = document.querySelector('anima-icon') as AnimaIcon;
            const ds = icon.load(xml, true);
            if (ds.some((d) => d.severity === 'error')) throw Error(JSON.stringify(ds));
          },
          readFileSync('modules/nested/examples/controls.animl', 'utf8'),
        );
        await expect
          .poll(() =>
            page.evaluate(() =>
              document
                .querySelector('anima-icon')!
                .shadowRoot!.querySelector('g[id$="clocked/dot"] circle')
                ?.getAttribute('r'),
            ),
          )
          .toBe('2.5');
        expect(
          await page.evaluate(() =>
            (document.querySelector('anima-icon') as AnimaIcon).player!.get('clocked.outputs.done'),
          ),
        ).toBe(true);
      } finally {
        await page.close();
      }
    });
    it('keeps the authored blue foreground after dynamic slot reuse in SVG and canvas', async () => {
      const page = await browser.newPage();
      try {
        await page.setContent(
          '<anima-icon paused style="display:block;width:200px;height:200px"></anima-icon>',
        );
        for (const n of ['index', 'components', 'data', 'bind', 'nested', 'canvas'])
          await page.addScriptTag({ type: 'module', content: bundles.get(n)! });
        await page.waitForFunction(
          () =>
            ['components', 'data', 'bind', 'nested'].every((n) =>
              (customElements.get('anima-icon') as typeof AnimaIcon)?.modules.has(n),
            ),
          {},
          { polling: 10 },
        );
        const doc = JSON.parse(
          readFileSync('spec/conformance/data-property-artboard/case.ani', 'utf8'),
        );
        const nodes = [
          { id: 'red', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#ff0000' } },
          { id: 'blue', type: 'rect', x0: 0, y0: 0, w: 10, h: 10, fill: { color: '#0000ff' } },
        ];
        for (const name of ['row', 'box']) {
          doc.components[name].nodes = structuredClone(nodes);
          delete doc.components[name].bind;
        }
        await page.evaluate((doc) => {
          const icon = document.querySelector('anima-icon') as AnimaIcon;
          const ds = icon.load(doc);
          if (ds.length) throw Error(JSON.stringify(ds));
        }, doc);
        for (const backend of ['svg', 'canvas']) {
          await page.evaluate(
            (backend) =>
              (document.querySelector('anima-icon') as AnimaIcon).setAttribute('renderer', backend),
            backend,
          );
          for (const selected of ['row', 'box', 'row']) {
            await page.evaluate((name) => {
              const icon = document.querySelector('anima-icon') as AnimaIcon;
              icon.player!.set('$card', name);
              icon.player!.step(0);
              icon.invalidate();
            }, selected);
            const image = PNG.sync.read(
              await page.locator('anima-icon').locator(backend).first().screenshot(),
            );
            expect(
              [...image.data.subarray((5 * image.width + 5) * 4, (5 * image.width + 5) * 4 + 4)],
              backend + ':' + selected,
            ).toEqual([0, 0, 255, 255]);
          }
        }
      } finally {
        await page.close();
      }
    });
  });
